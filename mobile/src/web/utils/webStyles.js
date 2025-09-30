import { StyleSheet } from 'react-native';

// Web-compatible style utility that converts StyleSheet objects to plain objects
export const createWebStyles = (styleSheet) => {
  const plainStyles = {};
  
  // Convert StyleSheet object to plain object
  Object.keys(styleSheet).forEach(key => {
    const style = styleSheet[key];
    
    // If it's an array of styles, flatten it
    if (Array.isArray(style)) {
      plainStyles[key] = style.reduce((acc, s) => {
        if (s && typeof s === 'object') {
          return { ...acc, ...s };
        }
        return acc;
      }, {});
    } else if (style && typeof style === 'object') {
      plainStyles[key] = { ...style };
    } else {
      plainStyles[key] = style;
    }
  });
  
  return plainStyles;
};

// Hook to get web-compatible styles
export const useWebStyles = (styleSheet) => {
  return createWebStyles(styleSheet);
};

// Higher-order component to wrap styles
export const withWebStyles = (Component) => {
  return (props) => {
    const { style, ...otherProps } = props;
    
    // Convert style if it's a StyleSheet reference
    let webStyle = style;
    if (style && typeof style === 'object' && style._styleSheet) {
      webStyle = createWebStyles(style._styleSheet);
    }
    
    return <Component {...otherProps} style={webStyle} />;
  };
};

export default createWebStyles;
