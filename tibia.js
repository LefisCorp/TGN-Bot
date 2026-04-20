const fetch = global.fetch;

async function getCharacter(name) {
  const encodedName = encodeURIComponent(name.trim());
  const res = await fetch(`https://api.tibiadata.com/v4/character/${encodedName}`);
  if (!res.ok) return null;
  return await res.json();
}

async function getWorld(name) {
  const encodedName = encodeURIComponent(name.trim());
  const res = await fetch(`https://api.tibiadata.com/v4/world/${encodedName}`); // CORRECT
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

async function getItem(name) {
  // Format name for API (lowercase, no spaces)
  const itemName = name.toLowerCase().replace(/\s+/g, ''); 
  const res = await fetch(`https://api.tibiadata.com/v4/item/${itemName}`);
  if (!res.ok) return null;
  return await res.json();
}

async function getCreature(name) {
  // Format the name: lowercase and remove all spaces
  const race = name.toLowerCase().replace(/\s+/g, ''); 
  const res = await fetch(`https://api.tibiadata.com/v4/creature/${race}`);
  if (!res.ok) return null;
  return await res.json();
}

module.exports = {
  getCharacter,
  getWorld,
  getLatestNews,
  getNewsArticle,
  getCreature,
  getItem,
  async getCharacterDeathContext(name) {
        try {
            // encodeURIComponent handles names with spaces like "Bubble" or "Eternal Guardian"
            const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(name)}`);
            
            if (!response.ok) return null;
            
            const data = await response.json();
            const deaths = data.character?.deaths;

            // Return the most recent death if it exists, otherwise null
            return (deaths && deaths.length > 0) ? deaths[0] : null;
        } catch (error) {
            console.error(`Error fetching death context for ${name}:`, error);
            return null;
        }
      }
};