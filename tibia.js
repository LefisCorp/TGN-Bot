const fetch = global.fetch;

async function getCharacter(name) {
  const encodedName = encodeURIComponent(name.trim());
  const res = await fetch(`https://api.tibiadata.com/v4/character/${encodedName}`);
  if (!res.ok) return null;
  return await res.json();
}

async function getWorld(name) {
  const encodedName = encodeURIComponent(name.trim());
  const res = await fetch(`https://api.tibiadata.com/v4/world/${encodedName}`);
  if (!res.ok) return null;
  return await res.json();
}

async function getLatestNews() {
  const res = await fetch(`https://api.tibiadata.com/v4/news/latest`);
  if (!res.ok) return null;
  return await res.json();
}

async function getNewsArticle(id) {
  const encodedId = encodeURIComponent(String(id).trim());
  const res = await fetch(`https://api.tibiadata.com/v4/news/id/${encodedId}`);
  if (!res.ok) return null;
  return await res.json();
}

async function getCreature(name) {
  const encodedName = encodeURIComponent(name.trim());
  const res = await fetch(`https://api.tibiadata.com/v4/creature/${encodedName}`);
  if (!res.ok) return null;
  return await res.json();
}

module.exports = {
  getCharacter,
  getWorld,
  getLatestNews,
  getNewsArticle,
  getCreature
};