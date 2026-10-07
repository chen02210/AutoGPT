// Thin wrapper around chrome.storage.local for the homepage data model.
const STORAGE_KEY = "homepageData";

const DEFAULT_DATA = {
  categories: [
    {
      id: "cat-default",
      name: "常用",
      items: [
        { id: "site-1", name: "Google", url: "https://www.google.com" },
        { id: "site-2", name: "GitHub", url: "https://github.com" },
        { id: "site-3", name: "YouTube", url: "https://www.youtube.com" }
      ]
    }
  ]
};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const Storage = {
  async load() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY];
    if (!data || !Array.isArray(data.categories)) {
      await this.save(DEFAULT_DATA);
      return structuredClone(DEFAULT_DATA);
    }
    return data;
  },

  async save(data) {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }
};
