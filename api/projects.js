export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: 'Published',
          checkbox: { equals: true }
        },
        sorts: [{ property: 'Order', direction: 'ascending' }]
      })
    });

    const data = await response.json();

    const projects = data.results.map(page => {
      const p = page.properties;
      return {
        id: page.id,
        title: p.Name?.title?.[0]?.plain_text || '',
        category: p.Category?.rich_text?.[0]?.plain_text || '',
        client: p.Client?.rich_text?.[0]?.plain_text || '',
        description: p.Description?.rich_text?.[0]?.plain_text || '',
        thumbnail: p.Thumbnail?.url || null,
        cover: p.Cover?.url || null,
        tags: (p.Tags?.rich_text?.[0]?.plain_text || '').split(',').map(t => t.trim()).filter(Boolean),
        scope: (p.Scope?.rich_text?.[0]?.plain_text || '').split(',').map(s => s.trim()).filter(Boolean),
        order: p.Order?.number || 0,
      };
    });

    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
}
