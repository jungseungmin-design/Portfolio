export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;
  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST', headers,
      body: JSON.stringify({
        filter: { property: 'Published', checkbox: { equals: true } },
        sorts: [{ property: 'Order', direction: 'ascending' }]
      })
    });
    const dbData = await dbRes.json();

    const projects = await Promise.all(dbData.results.map(async page => {
      const p = page.properties;

      const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`, {
        headers
      });
      const blocksData = await blocksRes.json();
      const blocks = parseBlocks(blocksData.results || []);

      return {
        id: page.id,
        title: p.Name?.title?.[0]?.plain_text || '',
        category: p.Category?.rich_text?.[0]?.plain_text || '',
        client: p.Client?.rich_text?.[0]?.plain_text || '',
        thumbnail: p.Thumbnail?.url || null,
        thumbnailMobile: p.Thumbnail_Mobile?.url || null,
        videoThumb: p.Video_Thumb?.url || null,
        cover: p.Cover?.url || null,
        ratio: p.Ratio?.rich_text?.[0]?.plain_text || null,
        bgColor: p.BgColor?.rich_text?.[0]?.plain_text || null,
        slogan: p.Slogan?.rich_text?.[0]?.plain_text || null,
        tags: (p.Tags?.rich_text?.[0]?.plain_text || '').split(',').map(t => t.trim()).filter(Boolean),
        scope: (p.Scope?.rich_text?.[0]?.plain_text || '').split(',').map(s => s.trim()).filter(Boolean),
        order: p.Order?.number || 0,
        blocks,
      };
    }));

    res.status(200).json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

function parseBlocks(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    const b = raw[i];
    const type = b.type;

    if (type === 'paragraph') {
      const text = richText(b.paragraph.rich_text);
      if (text) out.push({ type: 'text', text });
      i++; continue;
    }
    if (type === 'heading_2') {
      out.push({ type: 'heading', level: 2, text: richText(b.heading_2.rich_text) });
      i++; continue;
    }
    if (type === 'heading_3') {
      out.push({ type: 'heading', level: 3, text: richText(b.heading_3.rich_text) });
      i++; continue;
    }
    if (type === 'quote') {
      const text = richText(b.quote.rich_text);
      if (text) out.push({ type: 'quote', text });
      i++; continue;
    }
    if (type === 'image') {
      const url = b.image.type === 'external' ? b.image.external.url : b.image.file?.url || '';
      const caption = richText(b.image.caption || []);
      // 연속 이미지 묶기 (최대 3장)
      const group = [{ url, caption }];
      while (i + group.length < raw.length && raw[i + group.length].type === 'image') {
        const nb = raw[i + group.length];
        const nurl = nb.image.type === 'external' ? nb.image.external.url : nb.image.file?.url || '';
        const ncap = richText(nb.image.caption || []);
        group.push({ url: nurl, caption: ncap });
        if (group.length === 3) break;
      }
      out.push({ type: 'images', images: group });
      i += group.length; continue;
    }
    if (type === 'video') {
      const url = b.video.type === 'external' ? b.video.external.url : b.video.file?.url || '';
      out.push({ type: 'video', url });
      i++; continue;
    }
    if (type === 'bookmark' || type === 'embed') {
      const url = b[type]?.url || '';
      out.push({ type: 'video', url });
      i++; continue;
    }
    if (type === 'divider') {
      out.push({ type: 'divider' });
      i++; continue;
    }
    i++;
  }
  return out;
}

function richText(arr) {
  if (!arr || !arr.length) return '';
  return arr.map(t => t.plain_text || '').join('');
}
