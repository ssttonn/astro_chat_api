module.exports = function idConversionPlugin(schema) {
    schema.set('toJSON', {
      virtuals: true, // Include virtuals in the output
      transform: function (_, ret) {
        // Convert _id to id

        const newReturn = {
            id: ret._id,
        };
        delete ret._id;
        delete ret.__v; // Optionally remove the __v field (version key)

        return {
            ...newReturn,
            ...ret,
        };
      }
    });
  };