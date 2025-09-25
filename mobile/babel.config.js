module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Custom plugin to transform import.meta
      function() {
        return {
          visitor: {
            MetaProperty(path) {
              if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
                path.replaceWithSourceString('process');
              }
            },
            MemberExpression(path) {
              if (path.node.object && 
                  path.node.object.type === 'MetaProperty' && 
                  path.node.object.meta.name === 'import' && 
                  path.node.object.property.name === 'meta' &&
                  path.node.property.name === 'env') {
                path.replaceWithSourceString('process.env');
              }
            }
          }
        };
      }
    ],
  };
};
