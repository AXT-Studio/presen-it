import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const markdown = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify);

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!;
    });
}

/** Render only CommonMark in the PoC; legacy syntax is deliberately deferred. */
export async function renderDocument(source: string, title: string): Promise<string> {
    const body = String(await markdown.process(source));
    return `<!doctype html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | AXT Presen'it! PoC</title>
    <style>
        :root { font-family: system-ui, sans-serif; line-height: 1.6; color: #222; background: #fafafa; }
        body { max-width: 64rem; margin: 3rem auto; padding: 0 1.5rem; }
        main { padding: 2rem; background: white; border: 1px solid #ddd; }
        pre { overflow: auto; padding: 1rem; background: #eee; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <header><p>AXT Presen'it! — PoC</p></header>
    <main>${body}</main>
</body>
</html>`;
}
