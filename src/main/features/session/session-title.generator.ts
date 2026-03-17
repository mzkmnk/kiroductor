import { uniqueNamesGenerator, type Config } from 'unique-names-generator';

/** 世界の著名な都市名リスト。 */
const cities: string[] = [
  'Tokyo',
  'Kyoto',
  'Osaka',
  'Sapporo',
  'Fukuoka',
  'Naha',
  'Paris',
  'Lyon',
  'Bordeaux',
  'Vienna',
  'Salzburg',
  'Prague',
  'Budapest',
  'Amsterdam',
  'Rotterdam',
  'Lisbon',
  'Porto',
  'Barcelona',
  'Seville',
  'Valencia',
  'Milan',
  'Florence',
  'Venice',
  'Naples',
  'Palermo',
  'Athens',
  'Thessaloniki',
  'Istanbul',
  'Ankara',
  'Nairobi',
  'Addis Ababa',
  'Lagos',
  'Accra',
  'Cape Town',
  'Havana',
  'Bogota',
  'Medellin',
  'Lima',
  'Cusco',
  'Santiago',
  'Valparaiso',
  'Buenos Aires',
  'Montevideo',
  'Portland',
  'Seattle',
  'Denver',
  'Nashville',
  'Charleston',
  'Savannah',
  'Montreal',
  'Quebec',
  'Vancouver',
  'Reykjavik',
  'Oslo',
  'Bergen',
  'Stockholm',
  'Gothenburg',
  'Copenhagen',
  'Helsinki',
  'Tallinn',
  'Riga',
  'Vilnius',
  'Tbilisi',
  'Yerevan',
  'Baku',
  'Almaty',
  'Tashkent',
  'Colombo',
  'Hanoi',
  'Hoi An',
  'Chiang Mai',
  'Luang Prabang',
];

/** コーヒー豆品種名リスト。 */
const coffeeBeans: string[] = [
  'Bourbon',
  'Typica',
  'Geisha',
  'Caturra',
  'Catuai',
  'Mundo Novo',
  'Maragogipe',
  'SL28',
  'SL34',
  'Pacamara',
  'Pacas',
  'Villa Sarchi',
  'Laurina',
  'Sudan Rume',
  'Rume Sudan',
  'Yirgacheffe',
  'Sidama',
  'Harrar',
  'Limu',
  'Jimma',
  'Cauvery',
  'Kent',
  'S795',
  'Jember',
  'Timor',
  'Catimor',
  'Sarchimor',
  'Mokka',
  'Bergendal',
  'Linie',
];

/**
 * 都市名とコーヒー豆品種名を合わせた全タイトル候補リスト。
 * テストでの検証に使用する。
 */
export const ALL_TITLES: string[] = [...cities, ...coffeeBeans];

const config: Config = {
  dictionaries: [ALL_TITLES],
  separator: '',
  length: 1,
};

/**
 * 都市名またはコーヒー豆品種名からランダムに1つ選んでセッションタイトルを生成する。
 *
 * @returns ランダムに選ばれたタイトル文字列
 */
export function generateSessionTitle(): string {
  return uniqueNamesGenerator(config);
}
