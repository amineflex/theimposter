import rawCountries from 'world-countries'
import type { LetterPopCategoryId, LetterPopDifficulty } from '../types'

export interface LetterPopDatasetEntry {
  id: string
  categoryId: LetterPopCategoryId
  canonical: string
  aliases: string[]
  searchableParts: string[]
  difficulty: LetterPopDifficulty
}

function slug(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function entry(
  categoryId: LetterPopCategoryId,
  canonical: string,
  aliases: string[] = [],
  searchableParts: string[] = [],
  difficulty: LetterPopDifficulty = 'normal',
): LetterPopDatasetEntry {
  const canonicalKey = slug(canonical)
  const seen = new Set<string>()
  const cleanAliases = aliases.filter((alias) => {
    const key = slug(alias)
    if (!key || key === canonicalKey || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { id: `${categoryId}-${canonicalKey}`, categoryId, canonical, aliases: cleanAliases, searchableParts, difficulty }
}

function simple(categoryId: LetterPopCategoryId, values: string): LetterPopDatasetEntry[] {
  return values.split('|').map((value) => entry(categoryId, value.trim()))
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  CD: ['RDC', 'Congo-Kinshasa', 'République démocratique du Congo'],
  CG: ['Congo-Brazzaville', 'République du Congo'],
  CI: ["Côte d'Ivoire", 'Cote d Ivoire'],
  CZ: ['Tchéquie', 'République tchèque'],
  GB: ['Royaume-Uni', 'Grande-Bretagne', 'Angleterre', 'United Kingdom'],
  KR: ['Corée du Sud'], KP: ['Corée du Nord'], LA: ['Laos'], MD: ['Moldavie'],
  MK: ['Macédoine du Nord'], MM: ['Birmanie', 'Myanmar'], NL: ['Pays-Bas', 'Hollande'],
  PS: ['Palestine'], RU: ['Russie'], SZ: ['Eswatini', 'Swaziland'],
  US: ['États-Unis', 'Etats-Unis', 'USA', 'United States', 'Amérique'],
  VA: ['Vatican', 'Cité du Vatican'],
}

const countries = rawCountries.flatMap((country) => {
  const included = country.unMember || country.cca2 === 'VA' || country.cca2 === 'PS'
  if (!included) return []
  const canonical = country.translations.fra?.common ?? country.name.common
  return [entry('country', canonical, [country.name.common, ...(COUNTRY_ALIASES[country.cca2] ?? [])])]
})

const firstNames = simple('first-name',
  'Adam|Adèle|Adrien|Agathe|Alain|Alexandre|Alice|Alicia|Amélie|Amine|Anaïs|André|Anna|Antoine|Arthur|Aya|Baptiste|Bastien|Béatrice|Benjamin|Bilal|Bruno|Camille|Carla|Caroline|Cédric|Chloé|Clara|Clément|David|Diane|Élodie|Emma|Éric|Eva|Fabien|Fatima|Félix|Florian|Gabriel|Gaëlle|Hana|Hassan|Hélène|Hugo|Inès|Iris|Isabelle|Jade|Jamal|Jean|Jeanne|Jules|Karim|Kenza|Laura|Léa|Léo|Lina|Louise|Lucas|Manon|Marc|Marie|Mathieu|Mehdi|Mélanie|Mohamed|Nadia|Nathan|Nina|Noah|Océane|Omar|Paul|Rayan|Romain|Sarah|Sofia|Thomas|Valentin|Yasmine|Yanis|Zoé',
)

const cities = simple('city',
  'Abidjan|Abu Dhabi|Agadir|Aix-en-Provence|Alger|Amsterdam|Anvers|Athènes|Atlanta|Bamako|Barcelone|Bâle|Bastia|Berlin|Beyrouth|Birmingham|Bogota|Bordeaux|Boston|Brasilia|Bratislava|Bruxelles|Budapest|Buenos Aires|Caire|Casablanca|Chicago|Copenhague|Dakar|Delhi|Doha|Dubaï|Dublin|Édimbourg|Florence|Francfort|Genève|Gand|Grenoble|Hanoï|Helsinki|Hong Kong|Istanbul|Jakarta|Jérusalem|Johannesburg|Kiev|Kinshasa|La Haye|Lausanne|Le Cap|Liège|Lille|Lisbonne|Londres|Los Angeles|Luxembourg|Lyon|Madrid|Marrakech|Marseille|Mexico|Miami|Milan|Monaco|Montréal|Moscou|Mumbai|Nairobi|Namur|Naples|New York|Nice|Oslo|Ottawa|Paris|Pékin|Porto|Prague|Québec|Rabat|Reims|Rennes|Rio de Janeiro|Rome|Rotterdam|Saint-Étienne|San Francisco|Séoul|Shanghai|Singapour|Stockholm|Strasbourg|Sydney|Tokyo|Toulouse|Tunis|Valence|Venise|Vienne|Varsovie|Washington|Zurich',
)

const animals = simple('animal',
    'Abeille|Aigle|Alpaga|Âne|Araignée|Autruche|Babouin|Baleine|Bison|Blaireau|Boa|Bouc|Buffle|Canard|Castor|Cerf|Chameau|Chat|Chauve-souris|Chèvre|Chien|Chimpanzé|Cigogne|Cobra|Cochon|Colibri|Coq|Corbeau|Crocodile|Dauphin|Dindon|Écureuil|Éléphant|Escargot|Faisan|Faucon|Flamant rose|Fourmi|Girafe|Gorille|Guépard|Hamster|Hérisson|Hibou|Hippopotame|Hyène|Iguane|Jaguar|Kangourou|Koala|Lapin|Léopard|Lion|Loup|Loutre|Lynx|Marmotte|Méduse|Morse|Mouche|Mouton|Oie|Orang-outan|Orque|Ours|Panda|Panthère|Paon|Perroquet|Phoque|Pieuvre|Pingouin|Poule|Puma|Renard|Requin|Rhinocéros|Sanglier|Serpent|Singe|Souris|Tigre|Tortue|Toucan|Vache|Zèbre',
  ).map((item) => item.canonical === 'Chat' ? { ...item, aliases: ['Chats'] } : item)

const jobs = simple('job',
  'Acteur|Agriculteur|Architecte|Artisan|Astronaute|Avocat|Barman|Bibliothécaire|Boucher|Boulanger|Caissier|Carreleur|Chanteur|Chauffeur|Chirurgien|Coiffeur|Comptable|Cuisinier|Danseur|Dentiste|Développeur|Électricien|Enseignant|Facteur|Fleuriste|Garagiste|Gendarme|Graphiste|Horloger|Infirmier|Ingénieur|Jardinier|Journaliste|Juge|Kinésithérapeute|Libraire|Maçon|Médecin|Menuisier|Militaire|Notaire|Opticien|Pâtissier|Peintre|Pharmacien|Photographe|Pilote|Plombier|Policier|Professeur|Psychologue|Réalisateur|Réceptionniste|Serveur|Serrurier|Traducteur|Vétérinaire',
)

const objects = simple('object',
  'Agrafeuse|Aiguille|Allumette|Ampoule|Armoire|Assiette|Bague|Balance|Ballon|Batterie|Biberon|Bocal|Boîte|Bougie|Bouteille|Brosse|Cadenas|Cahier|Calculatrice|Canapé|Carte|Casque|Casserole|Chaise|Chargeur|Ciseaux|Clavier|Cloche|Coffre|Coussin|Couteau|Crayon|Cuillère|Écharpe|Échelle|Éponge|Fourchette|Gobelet|Gomme|Horloge|Imprimante|Jumelles|Lampe|Livre|Loupe|Marteau|Matelas|Microphone|Miroir|Montre|Ordinateur|Oreiller|Parapluie|Peigne|Pinceau|Poêle|Portefeuille|Poubelle|Règle|Réveil|Rideau|Sac|Savon|Stylo|Table|Tablette|Télécommande|Téléphone|Thermomètre|Tire-bouchon|Trombone|Valise|Vase|Ventilateur|Verre',
)

const foods = simple('food',
  'Abricot|Ail|Amande|Ananas|Artichaut|Aubergine|Avocat|Banane|Beignet|Betterave|Biscuit|Bœuf|Bonbon|Brocoli|Burger|Cabillaud|Cacahuète|Café|Carotte|Cerise|Champignon|Chocolat|Citron|Clémentine|Concombre|Cookie|Courgette|Crêpe|Crevette|Croissant|Datte|Éclair|Épinard|Fraise|Framboise|Frite|Fromage|Gaufre|Glace|Haricot|Kiwi|Lasagnes|Lentille|Macaron|Mangue|Melon|Miel|Moule|Moutarde|Noisette|Noix|Olive|Orange|Pain|Pamplemousse|Pastèque|Pâtes|Pêche|Petit pois|Pizza|Poire|Poireau|Poisson|Pomme|Pomme de terre|Poulet|Quiche|Raisin|Riz|Salade|Saumon|Saucisse|Soupe|Steak|Sushi|Tomate|Yaourt',
)

const brands = simple('brand',
  'Adidas|Adobe|Airbus|Aldi|Amazon|Apple|Asics|Audi|Bic|BMW|Bosch|Burger King|Canon|Carrefour|Cartier|Chanel|Citroën|Coca-Cola|Danone|Decathlon|Dell|Disney|Ferrari|Fiat|Google|Gucci|Heineken|Honda|Ikea|Intel|Lacoste|Lego|Lenovo|Lidl|Logitech|Louis Vuitton|McDonald’s|Mercedes|Meta|Michelin|Microsoft|Nestlé|Netflix|Nike|Nintendo|Nokia|Nvidia|Orange|Peugeot|Philips|PlayStation|Puma|Renault|Rolex|Samsung|Sony|Spotify|Starbucks|Tesla|Toyota|Ubisoft|Visa|Volvo|Xiaomi|YouTube|Zara',
)

const entertainment = [
  ...simple('entertainment',
    'Avatar|Avengers|Astérix|Baldur’s Gate|Batman|Black Mirror|Breaking Bad|Call of Duty|Cars|Casa de Papel|Cendrillon|Cyberpunk 2077|Dark|Deadpool|Dune|Elden Ring|Encanto|FIFA|Fortnite|Friends|Game of Thrones|Gladiator|God of War|Gran Turismo|Harry Potter|House of Cards|Indiana Jones|Interstellar|James Bond|Jurassic Park|Kaamelott|Le Roi Lion|Les Simpson|Lost|Lupin|Mario Kart|Matrix|Minecraft|Mission Impossible|Monopoly|Narcos|One Piece|Oppenheimer|Peaky Blinders|Pokémon|Pulp Fiction|Ratatouille|Red Dead Redemption|Rocky|Shrek|Spider-Man|Star Wars|Stranger Things|Super Mario|Tenet|The Last of Us|The Office|The Witcher|Titanic|Toy Story|Uncharted|Vikings|Wednesday|World of Warcraft|Zelda',
  ),
  entry('entertainment', 'Le Seigneur des anneaux', ['Lord of the Rings']),
  entry('entertainment', 'La Reine des neiges', ['Frozen']),
]

const celebrities = simple('celebrity',
  'Adele|Albert Einstein|Alain Delon|Amélie Nothomb|Angelina Jolie|Antoine Griezmann|Aya Nakamura|Barack Obama|Beyoncé|Bill Gates|Bob Marley|Brad Pitt|Brigitte Bardot|Bruce Lee|Céline Dion|Charles Aznavour|Charlie Chaplin|Cristiano Ronaldo|David Beckham|Denzel Washington|Dua Lipa|Ed Sheeran|Elon Musk|Emma Watson|Freddie Mercury|Gad Elmaleh|George Clooney|Greta Thunberg|Harrison Ford|Isaac Newton|Jackie Chan|Jean Dujardin|Jean-Jacques Goldman|Jennifer Lopez|Johnny Depp|Jul|Kanye West|Karim Benzema|Katy Perry|Keanu Reeves|Kendji Girac|Kevin De Bruyne|Kylian Mbappé|Lady Gaga|Leonardo DiCaprio|Lionel Messi|Madonna|Marion Cotillard|Matt Damon|Michael Jackson|Michelle Obama|Morgan Freeman|Neymar|Omar Sy|Oprah Winfrey|Pablo Picasso|Pharrell Williams|Rafael Nadal|Rihanna|Robert De Niro|Soprano|Stromae|Taylor Swift|Thomas Pesquet|Tom Cruise|Usain Bolt|Vanessa Paradis|Victor Hugo|Vincent Cassel|Will Smith|Zinedine Zidane',
).map((item) => ({ ...item, searchableParts: item.canonical.split(/\s+/) }))

const sports = simple('sport',
  'Athlétisme|Aviron|Badminton|Baseball|Basketball|Biathlon|Billard|Boxe|Canoë|Cyclisme|Danse|Équitation|Escalade|Escrime|Football|Formule 1|Golf|Gymnastique|Handball|Hockey|Judo|Karaté|Kayak|Lutte|Moto-cross|Natation|Padel|Patinage|Pétanque|Rugby|Ski|Snowboard|Surf|Taekwondo|Tennis|Tir à l’arc|Triathlon|Voile|Volleyball',
)

const clothing = simple('clothing',
  'Anorak|Baskets|Bermuda|Blouson|Bonnet|Bottes|Boxer|Cachemire|Casquette|Ceinture|Chaussettes|Chaussures|Chemise|Chemisier|Costume|Cravate|Débardeur|Écharpe|Gants|Gilet|Jean|Jupe|Legging|Lunettes|Maillot|Manteau|Mocassins|Pantalon|Pantoufles|Pull|Pyjama|Robe|Sandales|Short|Slip|Sweat|T-shirt|Tailleur|Tongs|Veste',
)

export const LETTER_POP_DATASETS: Record<LetterPopCategoryId, readonly LetterPopDatasetEntry[]> = {
  'first-name': firstNames,
  country: countries,
  city: cities,
  animal: animals,
  job: jobs,
  object: objects,
  food: foods,
  brand: brands,
  entertainment,
  celebrity: celebrities,
  sport: sports,
  clothing,
}

export const LETTER_POP_DATASET_SIZE = Object.values(LETTER_POP_DATASETS)
  .reduce((total, dataset) => total + dataset.length, 0)
