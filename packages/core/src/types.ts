export type ContentType = "blog" | "social" | "marketing";

export interface GenerateContentInput {
  /** What the content should be about — a topic, product, or short brief. */
  brief: string;
  contentType: ContentType;
  /** e.g. "playful", "professional", "urgent". Defaults to "professional". */
  tone?: string;
  /** Approximate target length in words. */
  length?: number;
  /** Anthropic model id. Defaults to a current Claude model. */
  model?: string;
}

export interface GenerateContentResult {
  content: string;
  contentType: ContentType;
  model: string;
}
