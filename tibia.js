const fetch = global.fetch;
const API_BASE_URL = 'https://api.tibiadata.com/v5';

async function request(endpoint) {
  const res = await fetch(`${API_BASE_URL}/${endpoint}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`TibiaData API request failed with status ${res.status}`);
  }
  return res.json();
}

async function getCharacter(name) {
  const encodedName = encodeURIComponent(name.trim());
  return request(`character/${encodedName}`);
}

async function getWorld(name) {
  const encodedName = encodeURIComponent(name.trim());
  return request(`world/${encodedName}`);
}

async function getLatestNews() {
  return request('news/latest');
}

async function getNewsArticle(id) {
  const encodedId = encodeURIComponent(String(id).trim());
  return request(`news/id/${encodedId}`);
}

async function getItem(name) {
  const itemName = encodeURIComponent(name.toLowerCase().replace(/\s+/g, ''));
  return request(`item/${itemName}`);
}

async function getCreature(name) {
  const race = encodeURIComponent(name.toLowerCase().replace(/\s+/g, ''));
  return request(`creature/${race}`);
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
      const data = await getCharacter(name);
      const deaths = data?.character?.deaths;
      return deaths?.length ? deaths[0] : null;
    } catch (error) {
      console.error(`Error fetching death context for ${name}:`, error);
      return null;
    }
  }
};