/**
 * @title Settings
 * @description Operator-editable settings for this cloud app.
 */
export type Settings = {
  // TODO: @uiOptions on array properties is not extracted by ts-schema into
  // meta-schema.json — the extractMeta array branch skips getRichMetaSchema.
  // Until ts-schema is patched, array-level UI hints (addable, orderable)
  // must be added to meta-schema.json manually or via a post-processing step.
  /**
   * @title Event names
   * @description Names of analytics events to emit.
   * @minItems 1
   * @default ["page_view", "click"]
   */
  eventNames: NonEmptyString[];

  /**
   * @title Frequency (ms)
   * @description Cadence between events in milliseconds.
   * @minimum 100
   * @default 2000
   * @asType integer
   */
  frequencyMs: number;
};

/**
 * @minLength 1
 */
type NonEmptyString = string;
