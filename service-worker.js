//
const version = '1.10.0'
const bonjourrCache = 'bonjourr-v' + version
const backgroundCache = 'background-v' + version

const filesToChache = [
	'index.html',
	'settings.html',
	'manifest.webmanifest',
	'src/scripts/main.js',
	'src/styles/style.css',
	'src/assets/favicon-128x128.png',
	'src/assets/favicon-512x512.png',
	'src/assets/apple-touch-icon.png',
	'src/assets/interface/gear.svg',
	'src/assets/interface/loading.gif',
]

const weatherList = [
	'snow',
	'mist',
	'clearsky',
	'fewclouds',
	'lightrain',
	'showerrain',
	'thunderstorm',
	'brokenclouds',
	'lightdrizzle',
	'showerdrizzle',
	'overcastclouds',
]

const addWeatherIcons = (time) => weatherList.forEach((elem) => filesToChache.push(`src/assets/weather/${time}/${elem}.png`))

addWeatherIcons('day')
addWeatherIcons('night')

//
//
// EVENTS
//
//

self.addEventListener('install', (event) =>
	event.waitUntil(caches.open(bonjourrCache).then((cache) => cache.addAll(filesToChache)))
)

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches.keys().then((keyList) => {
			return Promise.all(
				keyList.map((key) => {
					if (bonjourrCache.indexOf(key) === -1) {
						return caches.delete(key)
					}
				})
			)
		})
	)
})

self.addEventListener('fetch', function (event) {
	event.respondWith(
		caches.match(event.request).then(function (response) {
			// Cache hit - return response
			if (response) {
				return response
			}

			// IMPORTANT: Cloner la requête.
			// Une requete est un flux et est à consommation unique
			// Il est donc nécessaire de copier la requete pour pouvoir l'utiliser et la servir
			const fetchRequest = event.request.clone()

			return fetch(fetchRequest).then(function (response) {
				if (!response || response.status !== 200 || response.type !== 'basic') {
					return response
				}

				// IMPORTANT: Même constat qu'au dessus, mais pour la mettre en cache
				const responseToCache = response.clone()

				if (event.request.url.includes('unsplash.com') && event.request.url.includes('api.openweathermap.org'))
					caches.open(bonjourrCache).then(function (cache) {
						cache.put(event.request, responseToCache)
					})

				return response
			})
		})
	)
})
