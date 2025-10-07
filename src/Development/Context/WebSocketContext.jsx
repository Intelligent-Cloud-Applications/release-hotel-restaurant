import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Context } from '.';
import { Auth, API } from 'aws-amplify';
import AWS from 'aws-sdk';

const WebSocketContext = createContext(null);

const createNotificationAudio = () => {
  const audio = new Audio('/notification-18-270129.mp3');
  audio.preload = 'auto';
  return audio;
};

export const WebSocketProvider = ({ children }) => {
  const sqsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef(false);
  const messageListeners = useRef(new Set());
  const connectionAttemptsRef = useRef(0);
  const notificationSound = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const contextDataRef = useRef({});
  const { userData, auth, institutionData } = useContext(Context);
  
  // Stage-dependent queue URL
  const QUEUE_URL = process.env.REACT_APP_STAGE === 'prod' 
    ? 'https://sqs.us-east-1.amazonaws.com/922184331501/order-updates-queue' 
    : 'https://sqs.us-east-2.amazonaws.com/922184331501/order-updates-queue';
  
  // Debug logging utility
  const debugLog = useCallback((message, data = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] SQS Debug: ${message}`, data);
  }, []);
  
  // Initialize notification sound
  useEffect(() => {
    notificationSound.current = createNotificationAudio();
    
    notificationSound.current.addEventListener('error', (e) => {
      console.warn('Notification sound error:', e);
      if (notificationSound.current.src.includes('/notification-18-270129.mp3')) {
        notificationSound.current.src = '/notification-18-270129.mp3';
      }
    });
    
    return () => {
      if (notificationSound.current) {
        notificationSound.current.pause();
        notificationSound.current = null;
      }
    };
  }, []);
  
  // Keep context data updated
  useEffect(() => {
    contextDataRef.current = {
      institution: userData?.institution,
      cognitoId: userData?.cognitoId,
      userType: userData?.userType
    };
  }, [userData]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      if (notificationSound.current) {
        notificationSound.current.currentTime = 0;
        const playPromise = notificationSound.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('Error playing notification:', error);
            if (error.name === 'NotSupportedError') {
              notificationSound.current.src = '/notification-18-270129.mp3';
              notificationSound.current.load();
            }
          });
        }
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  // Subscribe to messages
  const subscribe = useCallback((listener) => {
    messageListeners.current.add(listener);
    return () => messageListeners.current.delete(listener);
  }, []);

  // Notify all listeners
  const notifyListeners = useCallback((message) => {
    playNotificationSound();
    
    messageListeners.current.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('Error in message listener:', error);
      }
    });
  }, [playNotificationSound]);

  // Create updated message for multi-admin scenarios
  const createProcessedMessage = useCallback(async (sqs, originalMessage, updatedData, delaySeconds = 25) => {
    try {
      const sendResult = await sqs.sendMessage({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(updatedData),
        DelaySeconds: delaySeconds, 
        MessageAttributes: originalMessage.MessageAttributes || {}
      }).promise();
      
      await sqs.deleteMessage({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: originalMessage.ReceiptHandle
      }).promise();
      
    
      
      return true;
    } catch (error) {
      console.error("Failed to create processed message:", error);
      return false;
    }
  }, [QUEUE_URL, debugLog]);

  // Refresh AWS credentials
  const refreshCredentials = useCallback(async () => {
    try {
      const credentials = await Auth.currentCredentials();
      AWS.config.update({
        region: process.env.REACT_APP_STAGE === 'prod' ? 'us-east-1' : 'us-east-2',
        credentials: Auth.essentialCredentials(credentials)
      });
      
      // Re-create SQS client with new credentials
      sqsRef.current = new AWS.SQS();
      return credentials;
    } catch (error) {
      console.error("Error refreshing credentials:", error);
      return null;
    }
  }, []);

  // Poll messages from SQS queue
  const pollMessages = useCallback(async (sqs, currentData) => {
    try {
      const pollStartTime = Date.now();
      const { Messages } = await sqs.receiveMessage({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
        MessageAttributeNames: ['All']
      }).promise();
      
      const pollDuration = Date.now() - pollStartTime;
      if (!Messages || Messages.length === 0) {
    
        return;
      }
      
      let processedCount = 0;
      let skippedWrongInstitution = 0;
      let skippedWrongAdmin = 0;
      
      for (const msg of Messages) {
        try {
          let messageData;
          try {
            messageData = JSON.parse(msg.Body);
          } catch (parseError) {
            console.error(`Failed to parse message ${msg.MessageId}:`, parseError);
            await sqs.deleteMessage({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }).promise();
            continue;
          }
       
          if (messageData.institution !== currentData.institution) {
            skippedWrongInstitution++;
            await new Promise(resolve => setTimeout(resolve, 20000));
            try {
              await sqs.deleteMessage({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: msg.ReceiptHandle
              }).promise();
              
             
            } catch (deleteError) {
              
            }
            continue;
          }
          
          // Check if this message is for this admin
          const isForThisAdmin = messageData.cognitoIds && 
                               messageData.cognitoIds.includes(currentData.cognitoId);
          
          if (!isForThisAdmin) {
            skippedWrongAdmin++;
            await sqs.changeMessageVisibility({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle,
              VisibilityTimeout: 1 
            }).promise();
            continue;
          }
          
          // Create a unique message key for this admin+message combination
          const messageId = messageData.messageId || msg.MessageId;
          const messageKey = `${messageId}-${currentData.cognitoId}`;
          
          // Check if we've already processed this message
          if (processedMessagesRef.current.has(messageKey)) {
            await sqs.deleteMessage({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }).promise();
            continue;
          }
        
          const timeoutPeriod = 30 * 60 * 1000; // 30 minutes
          const hasTimedOut = messageData.firstProcessedTimestamp && 
                             (Date.now() - messageData.firstProcessedTimestamp > timeoutPeriod);
          
          if (hasTimedOut) {
           
            await sqs.deleteMessage({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }).promise();
            continue;
          }
          
          // Process the message
          processedCount++;
         
          
          // Notify all listeners about this message
          notifyListeners(messageData);
          processedMessagesRef.current.add(messageKey);
          
          // Handle multi-admin message processing
          const isMultiAdminMessage = messageData.cognitoIds && messageData.cognitoIds.length > 1;
          
          if (isMultiAdminMessage) {
            const updatedMessageData = { ...messageData };
            
            // Initialize tracking fields
            if (!updatedMessageData.processedBy) {
              updatedMessageData.processedBy = [];
            }
            
            if (!updatedMessageData.firstProcessedTimestamp) {
              updatedMessageData.firstProcessedTimestamp = Date.now();
            }
            
            // Add current admin to processed list
            if (!updatedMessageData.processedBy.includes(currentData.cognitoId)) {
              updatedMessageData.processedBy.push(currentData.cognitoId);
            }
            
            // Check if all original admins have processed this message
            const originalAdmins = messageData.originalCognitoIds || messageData.cognitoIds;
            const allAdminsProcessed = originalAdmins.every(id => 
              updatedMessageData.processedBy.includes(id)
            );
            
            if (allAdminsProcessed) {
             
              // All admins have seen this message, delete it immediately
              await sqs.deleteMessage({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: msg.ReceiptHandle
              }).promise();
            } else {
             
              const remainingAdmins = originalAdmins.filter(id => 
                !updatedMessageData.processedBy.includes(id)
              );
              
            
             
              const newMessageData = {
                ...updatedMessageData,
                cognitoIds: remainingAdmins,
                originalCognitoIds: originalAdmins,
                lastProcessedBy: currentData.cognitoId,
                lastProcessedTimestamp: Date.now()
              };
              
              // Use 25-second delay to ensure proper coordination
              await createProcessedMessage(sqs, msg, newMessageData, 25);
            }
          } else {
           
            // Single admin message, delete after processing
            await sqs.deleteMessage({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }).promise();
          }
        } catch (messageError) {
          console.error(`Error processing message ${msg.MessageId}:`, messageError);
          try {
            // Delete problematic messages to avoid infinite processing attempts
            await sqs.deleteMessage({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: msg.ReceiptHandle
            }).promise();
          } catch (deleteError) {
            console.error(`Failed to delete problematic message ${msg.MessageId}:`, deleteError);
          }
        }
      }
    } catch (error) {
      console.error("SQS polling error:", error);
      throw error; // Re-throw to trigger reconnection logic
    }
  }, [QUEUE_URL, createProcessedMessage, notifyListeners, debugLog]);

  // Main connection and polling function
  const connectAndPoll = useCallback(async () => {
    if (!institutionData?.qr) {
      pollingRef.current = false;
      setIsConnected(false);
      return;
    }
    const { institution, cognitoId, userType } = contextDataRef.current;
    
    // Check user data validity
    if (userType === undefined && auth === true) {
      try {
        // Make sure we have institution data to make the API call
        if (institution) {
          const userData = await API.get(
            'main',
            `/user/get-userdata/${institution}`,
            {}
          );
          
          // Update the context data ref with the fetched data
          contextDataRef.current = {
            ...contextDataRef.current,
            userType: userData.userType,
            cognitoId: userData.cognitoId || contextDataRef.current.cognitoId
          };
          
          // Check if user is admin with the updated data
          if (contextDataRef.current.userType !== 'admin') {
            debugLog("User is not admin (from API data), skipping SQS setup");
            return;
          }
        } else {
          debugLog("Institution undefined, cannot fetch user data");
          return;
        }
      } catch (error) {
        console.error("Error fetching user data from API:", error);
        return;
      }
    } else if (userType !== 'admin') {
      debugLog("User is not admin, skipping SQS setup");
      return;
    }
    
    if (!institution || !cognitoId) {
      debugLog("Missing institution or cognitoId, skipping SQS setup");
      return;
    }
    
    if (pollingRef.current) {
      debugLog("Already polling, skipping new connection");
      return;
    }
    
    try {
      // Refresh credentials before starting
      await refreshCredentials();
      
      setIsConnected(true);
      pollingRef.current = true;
      connectionAttemptsRef.current = 0;
      
     
      
      // Main polling loop with minimum delay
      while (pollingRef.current && institutionData?.qr) {
        const loopStartTime = Date.now();
        
        try {
          const currentData = contextDataRef.current;
          
          // Check if user is still admin
          if (currentData.userType !== 'admin' || !institutionData?.qr) {
            pollingRef.current = false;
            setIsConnected(false);
            break;
          }
          
          await pollMessages(sqsRef.current, currentData);
          
          const loopDuration = Date.now() - loopStartTime;
          
          // Minimum loop delay to prevent excessive polling
          const minimumLoopDelay = 3000; 
          if (loopDuration < minimumLoopDelay) {
            const waitTime = minimumLoopDelay - loopDuration;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
        } catch (error) {
          console.error("Error during polling cycle:", error);
          
          if (error.code === 'ExpiredTokenException' || 
              error.message.includes('expired') || 
              error.code === 'CredentialsError') {
            await refreshCredentials();
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      setIsConnected(false);
    } catch (error) {
      console.error("Error setting up SQS connection:", error);
      setIsConnected(false);
      pollingRef.current = false;
      
      // Implement exponential backoff for reconnection
      const maxBackoff = 5 * 60 * 1000; // 5 minutes max
      const reconnectDelay = Math.min(
        maxBackoff, 
        1000 * Math.pow(2, Math.min(10, connectionAttemptsRef.current))
      );
      
      connectionAttemptsRef.current++;
      
      setTimeout(() => {
        connectAndPoll();
      }, reconnectDelay);
    }
  }, [auth, institutionData?.qr, pollMessages, refreshCredentials, debugLog]);

  // Set up SQS connection and credential refresh
  useEffect(() => {
    if (!institutionData?.qr) {
      pollingRef.current = false;
      setIsConnected(false);
      return;
    }
    let isMounted = true;
    let credentialRefreshTimer = null;
    
    const setupCredentialRefresh = async () => {
      try {
        const credentials = await refreshCredentials();
        
        if (!isMounted || !credentials) return;
        
        // Set timer for next refresh (slightly before expiry)
        if (credentials.expireTime) {
          const expirationTime = credentials.expireTime;
          const now = new Date();
          // Refresh 5 minutes before expiration
          const timeUntilExpiry = expirationTime - now - (5 * 60 * 1000);
          
          if (credentialRefreshTimer) {
            clearTimeout(credentialRefreshTimer);
          }
          
          credentialRefreshTimer = setTimeout(setupCredentialRefresh, 
            timeUntilExpiry > 0 ? timeUntilExpiry : 30000);
        } else {
          // If no expireTime is available, refresh every 45 minutes
          if (credentialRefreshTimer) {
            clearTimeout(credentialRefreshTimer);
          }
          credentialRefreshTimer = setTimeout(setupCredentialRefresh, 45 * 60 * 1000);
        }
      } catch (error) {
        console.error("Error in credential refresh:", error);
        
        if (isMounted) {
          credentialRefreshTimer = setTimeout(setupCredentialRefresh, 30000);
        }
      }
    };
    
    setupCredentialRefresh();
    connectAndPoll();
    
    // Periodic cleanup of processed messages cache
    const cleanupInterval = setInterval(() => {
      if (processedMessagesRef.current.size > 500) {
        const oldSize = processedMessagesRef.current.size;
        processedMessagesRef.current = new Set(
          Array.from(processedMessagesRef.current).slice(-200)
        );
        
        debugLog('🧹 Cleaned up processed messages cache', {
          oldSize,
          newSize: processedMessagesRef.current.size
        });
      }
    }, 10 * 60 * 1000); // Clean up every 10 minutes
    
    return () => {
      isMounted = false;
      pollingRef.current = false;
      setIsConnected(false);
      
      if (credentialRefreshTimer) {
        clearTimeout(credentialRefreshTimer);
      }
      
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
    };
  }, [institutionData?.qr, connectAndPoll, refreshCredentials, debugLog]);

  // Context value to expose to consumers
  const value = {
    isConnected,
    subscribe,
    playNotificationSound,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to consume WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};