import { useEffect } from "react";
import RoutesContainer from "./Development/routes";
import LoaderProvider from "./Development/components/LoaderProvider";
import DocumentTitle from "react-document-title";
import { Context } from "./Development/Context";
import { useContext } from "react";
import { WebSocketProvider } from "./Development/Context/WebSocketContext";
import "react-image-crop/dist/ReactCrop.css";
const capitalizeFirstLetter = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

// Function to dynamically set the favicon
const setFavicon = (logoUrl) => {
  if (!logoUrl) return;
  let link =
    document.querySelector("link[rel*='icon']") ||
    document.createElement("link");
  link.type = "image/x-icon";
  link.rel = "shortcut icon";
  link.href = logoUrl;
  document.head.appendChild(link);
};

// Function to verify meta tags
const verifyMetaTags = () => {
  const metaTags = {
    title: document.querySelector('meta[name="title"]')?.content,
    description: document.querySelector('meta[name="description"]')?.content,
    keywords: document.querySelector('meta[name="keywords"]')?.content,
    documentTitle: document.title
  };

  return metaTags;
};

function App() {
  const { ready, institutionData } = useContext(Context);

  // **Company Name as Title Source**
  const companyName = institutionData?.companyName || "Cafe";
  const documentTitle = `Welcome to ${capitalizeFirstLetter(companyName)}`;

  // **Meta Tags Title, Description, and Keywords**
  const metaTitle = institutionData?.seo?.title || documentTitle;
  const metaDescription =
    institutionData?.description || "Default description for the website.";
  const metaKeywords =
    institutionData?.seo?.keywords?.join(", ") || "default, keywords";

  useEffect(() => {
    // Update Meta Tags in <head>
    const updateOrCreateMetaTag = (name, content) => {
      let tag = document.querySelector(`meta[name='${name}']`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    // Set meta title, description, and keywords
    updateOrCreateMetaTag("title", metaTitle);
    updateOrCreateMetaTag("description", metaDescription);
    updateOrCreateMetaTag("keywords", metaKeywords);

    // Set the favicon dynamically
    setFavicon(institutionData?.logoUrl);

    // Verify meta tags after they're set
    setTimeout(() => {
      verifyMetaTags();
    }, 1000);
  }, [metaTitle, metaDescription, metaKeywords, institutionData?.logoUrl]);

  // GTM Setup
  useEffect(() => {
    if (institutionData.GTM_ID) {
      // Remove existing GTM script if any
      const existingScript = document.querySelector(
        'script[src*="googletagmanager"]'
      );
      if (existingScript) existingScript.remove();

      // Add GTM script dynamically
      const script = document.createElement("script");
      script.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${institutionData.GTM_ID}');
      `;
      document.head.appendChild(script);

      // Add noscript fallback dynamically
      const noscript = document.createElement("noscript");
      noscript.innerHTML = `
        <iframe src="https://www.googletagmanager.com/ns.html?id=${institutionData.GTM_ID}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe>
      `;
      document.body.appendChild(noscript);
    }
  }, [institutionData.GTM_ID]);

  if (ready) {
    document.body.style.setProperty(
      "--primary-color",
      institutionData.PrimaryColor
    );
    document.body.style.setProperty(
      "--secondary-color",
      institutionData.SecondaryColor
    );
    document.body.style.setProperty(
      "--light-primary-color",
      institutionData.LightPrimaryColor
    );
    return (
      <LoaderProvider>
        <DocumentTitle title={documentTitle}>
        <WebSocketProvider>
            <RoutesContainer />
          </WebSocketProvider>
        </DocumentTitle>
      </LoaderProvider>
    );
  } else {
    return <div></div>;
  }
}

export default App;
