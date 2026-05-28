const analyticsSchema = {
  version: 1,
  events: [
    {
      type: 'cloud_app_event',
      description:
        'Generic cloud-app emitted event. Use eventName to discriminate.',
      dimensions: {
        eventName: { type: 'string', description: 'Logical event name.' },
      },
      measures: {
        count: { type: 'integer', default: 1 },
      },
    },
  ],
};

export default analyticsSchema;
