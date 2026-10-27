import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import { get, put } from "../../api";
import { showError, showSuccess } from "../../utils/toaster";

const PAGES = [
  { key: "privacy-policy", label: "Privacy Policy", type: "policy" },
  { key: "terms-and-conditions", label: "Terms & Conditions", type: "policy" },
  { key: "cancellation-refund", label: "Cancellation & Refund", type: "policy" },
  { key: "booking-journey", label: "How MyYajmaan Works", type: "journey" },
  { key: "yajmaan-benefits", label: "Yajmaan Login Benefits", type: "benefits" },
  { key: "pandit-benefits", label: "Pandit Ji Login Benefits", type: "benefits" },
];

const RICH_TEXT_MODULES = {
  toolbar: [["bold", "italic", "underline", "strike"], [{ header: [2, 3, false] }], [{ list: "ordered" }, { list: "bullet" }], ["blockquote", "link"], ["clean"]],
};
const RICH_TEXT_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h2", "h3", "blockquote", "a"],
  ALLOWED_ATTR: ["href", "target", "rel"],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

function decodeHtmlEntities(value) {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

export default function AdminCmsPage() {
  const [items, setItems] = useState([]);
  const [selectedKey, setSelectedKey] = useState(PAGES[0].key);
  const [form, setForm] = useState({ title: "", description: "", body: "", cards: [] });
  const [policyMode, setPolicyMode] = useState("rich-text");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = PAGES.find((page) => page.key === selectedKey) || PAGES[0];
  const currentItem = items.find((item) => item.key === selectedKey);
  const current = currentItem?.content;
  const previewHtml = DOMPurify.sanitize(decodeHtmlEntities(form.body), RICH_TEXT_SANITIZE_OPTIONS);

  useEffect(() => {
    get("/admin/cms")
      .then((data) => setItems(data?.items || []))
      .catch(() => showError("Could not load CMS content."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setForm({
      title: current?.title || "",
      description: current?.description || "",
      body: current?.body || "",
      cards: current?.cards || [],
    });
  }, [selectedKey, current]);

  useEffect(() => {
    if (selected.type !== "policy") setPolicyMode("rich-text");
  }, [selected.type]);

  async function handleSave(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim() || (selected.type === "policy" && !form.body.replace(/<[^>]*>/g, "").trim()) || ((selected.type === "benefits" || selected.type === "journey") && form.cards.length === 0)) {
      showError("Please complete every required field before saving.");
      return;
    }
    const content = { title: form.title.trim(), description: form.description.trim() };
    if (selected.type === "policy") content.body = form.body.trim();
    if (selected.type === "benefits" || selected.type === "journey") content.cards = form.cards;
    setSaving(true);
    try {
      await put(`/admin/cms/${selectedKey}`, { content });
      setItems((existing) => existing.map((item) => item.key === selectedKey ? { ...item, content } : item));
      showSuccess("CMS content saved.");
    } catch (error) {
      showError(error?.message || "Could not save CMS content.");
    } finally {
      setSaving(false);
    }
  }

  function updateCard(index, field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      cards: currentForm.cards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card),
    }));
  }

  function addCard() {
    setForm((currentForm) => ({ ...currentForm, cards: [...currentForm.cards, { title: "", description: "" }] }));
  }

  function removeCard(index) {
    setForm((currentForm) => ({ ...currentForm, cards: currentForm.cards.filter((_, cardIndex) => cardIndex !== index) }));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-amber-100 bg-white p-3 shadow-sm"><h1 className="px-2 pb-3 font-serif text-xl font-semibold text-maroon">CMS</h1><nav className="space-y-1">{PAGES.map((page) => <button key={page.key} type="button" onClick={() => setSelectedKey(page.key)} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${selectedKey === page.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"}`}>{page.label}</button>)}</nav></aside>
      <form onSubmit={handleSave} className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-maroon">{selected.label}</h2>
        <p className="mt-1 text-sm text-slate-500">Policy pages support safe rich text. Scripts, embedded content, custom styles, and empty content are rejected.</p>
        {currentItem?.version && <p className="mt-2 text-xs font-semibold text-slate-500">Current version: {currentItem.version}</p>}
        {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading CMS content...</p> : <div className="mt-5 space-y-4">
          <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Title *</span><input value={form.title} maxLength={selected.type === "journey" ? 120 : 120} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon" />{selected.type === "journey" && <span className="mt-1 block text-xs text-slate-500">Maximum 12 words.</span>}</label>
          <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Description *</span><textarea value={form.description} maxLength={400} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon" />{selected.type === "journey" && <span className="mt-1 block text-xs text-slate-500">Maximum 35 words.</span>}</label>
          {selected.type === "policy" && <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Page Content *</span>
              <div className="flex rounded-lg border border-amber-200 bg-amber-50/50 p-0.5">
                {[{ key: "rich-text", label: "Rich Text" }, { key: "html", label: "HTML Source" }, { key: "preview", label: "Preview" }].map((mode) => (
                  <button key={mode.key} type="button" onClick={() => setPolicyMode(mode.key)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${policyMode === mode.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-white"}`}>{mode.label}</button>
                ))}
              </div>
            </div>
            {policyMode === "rich-text" && <ReactQuill theme="snow" value={form.body} onChange={(body) => setForm({ ...form, body })} modules={RICH_TEXT_MODULES} className="bg-white text-sm" />}
            {policyMode === "html" && <textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={16} spellCheck={false} className="w-full rounded-lg border border-amber-200 bg-slate-950 px-3 py-3 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-saffron" placeholder="<h2>Policy heading</h2>\n<p>Your policy content.</p>" />}
            {policyMode === "preview" && <div className="cms-rich-text min-h-[18rem] rounded-lg border border-amber-200 bg-parchment-50 p-5 text-sm leading-7 text-slate-600" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
            <span className="mt-1 block text-xs text-slate-500">Use headings, paragraphs, lists, emphasis, quotes, and safe links. HTML source and preview accept only those safe elements. Maximum 15,000 characters.</span>
          </div>}
          {(selected.type === "benefits" || selected.type === "journey") && <div><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase text-slate-500">{selected.type === "journey" ? "Journey Cards" : "Benefit Cards"} *</span><button type="button" onClick={addCard} disabled={form.cards.length >= 6} className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon disabled:opacity-50">Add card</button></div><div className="space-y-3">{form.cards.map((card, index) => <div key={index} className="rounded-lg border border-amber-100 bg-amber-50/40 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">Card {index + 1}</p><button type="button" onClick={() => removeCard(index)} disabled={form.cards.length <= 1} className="text-xs font-semibold text-rose-600 disabled:opacity-40">Remove</button></div><input value={card.title} maxLength={60} onChange={(event) => updateCard(index, "title", event.target.value)} placeholder="Card title" className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-maroon" /><textarea value={card.description} maxLength={220} rows={3} onChange={(event) => updateCard(index, "description", event.target.value)} placeholder="Card description" className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-maroon" /></div>)}</div><span className="mt-2 block text-xs text-slate-500">Up to 6 cards. Each title allows 8 words; each description allows 40 words.</span></div>}
          <button type="submit" disabled={saving} className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save Content"}</button>
        </div>}
      </form>
    </div>
  );
}