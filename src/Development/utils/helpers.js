export const capitalize = (str) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

export const truncate = (str, len) =>
  str.length > len ? str.slice(0, len) + '...' : str;
