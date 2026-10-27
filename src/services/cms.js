import { get } from "../api";

export async function getCmsContent(key) {
  return get(`/cms/${key}`);
}