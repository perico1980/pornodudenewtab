import { settingsInit } from './settings'

import storage from './storage'
import clock from './features/clock'
import notes from './features/notes'
import quotes from './features/quotes'
import weather from './features/weather'
import searchbar from './features/searchbar'
import customFont from './features/fonts'
import quickLinks from './features/links'
import moveElements from './features/move'
import hideElements from './features/hide'
import localBackgrounds from './features/localbackgrounds'
import unsplashBackgrounds from './features/unsplash'

import { SYSTEM_OS, BROWSER, PLATFORM, IS_MOBILE, SYNC_DEFAULT, CURRENT_VERSION } from './defaults'
import { traduction, tradThis, setTranslationCache } from './utils/translations'
import { periodOfDay, stringMaxSize } from './utils'
import { eventDebounce } from './utils/debounce'
import onSettingsLoad from './utils/onsettingsload'
import errorMessage from './utils/errormessage'
import suntime from './utils/suntime'

import type { Sync, MoveKeys } from './types/sync'
import type { Local } from './types/local'

type FunctionsLoadState = 'Off' | 'Waiting' | 'Ready'

const dominterface = document.getElementById('interface') as HTMLDivElement
const functionsLoad: { [key: string]: FunctionsLoadState } = {
	clock: 'Waiting',
	links: 'Waiting',
	fonts: 'Off',
	quotes: 'Off',
}

let loadtimeStart = performance.now()

export const freqControl = {
	set: () => {
		return new Date().getTime()
	},

	get: (every: string, last: number) => {
		const nowDate = new Date()
		const lastDate = new Date(last || 0)
		const changed = {
			date: nowDate.getDate() !== lastDate.getDate(),
			hour: nowDate.getHours() !== lastDate.getHours(),
		}

		switch (every) {
			case 'day':
				return changed.date

			case 'hour':
				return changed.date || changed.hour

			case 'tabs':
				return true

			case 'pause':
				return last === 0

			case 'period': {
				return last === 0 ? true : periodOfDay() !== periodOfDay(+lastDate) || false
			}

			default:
				return false
		}
	},
}

const interfaceFade = (function interfaceFadeDebounce() {
	let fadeTimeout: number

	async function apply(duration = 400) {
		clearTimeout(fadeTimeout)

		// Wait for grid change (in ::root css var) to fade back in
		let observer = new MutationObserver(() => {
			fadeTimeout = setTimeout(() => (dominterface.style.transition = ''), duration)
			dominterface.style.removeProperty('opacity')
			observer.disconnect()
		})

		observer.observe(document.documentElement, { attributes: true })

		// Do fade out and then wait for the duration of the transition
		dominterface.style.opacity = '0'
		dominterface.style.transition = `opacity ${duration}ms cubic-bezier(.215,.61,.355,1)`
		await new Promise((resolve) => setTimeout(resolve, duration))
	}

	return { apply }
})()

export async function toggleWidgetsDisplay(list: { [key in MoveKeys]?: boolean }, fromInput?: true) {
	const listEntries = Object.entries(list)

	const widgets = {
		time: { domid: 'time', inputid: 'i_time' },
		main: { domid: 'main', inputid: 'i_main' },
		quicklinks: { domid: 'linkblocks', inputid: 'i_quicklinks' },
		notes: { domid: 'notes_container', inputid: 'i_notes' },
		quotes: { domid: 'quotes_container', inputid: 'i_quotes' },
		searchbar: { domid: 'sb_container', inputid: 'i_sb' },
	}

	// toggle settings option drawers
	listEntries.forEach(([key, on]) => {
		const option = document.getElementById(key + '_options')
		option?.classList.toggle('shown', on)
	})

	// toggle 'enable' switches
	listEntries.forEach(([key, on]) => {
		if (key in widgets) {
			const id = widgets[key as keyof typeof widgets].inputid
			const input = document.getElementById(id) as HTMLInputElement

			if (id && input) {
				input.checked = on
			}
		}
	})

	// Fade interface
	await interfaceFade.apply(200)

	// toggle widget on interface
	listEntries.forEach(([key, on]) => {
		if (key in widgets) {
			const id = widgets[key as keyof typeof widgets].domid
			document.getElementById(id)?.classList.toggle('hidden', !on)
		}
	})

	// user is toggling from settings, update grid
	if (fromInput) {
		const [id, on] = listEntries[0] // always only one toggle
		moveElements(null, { widget: { id: id as MoveKeys, on: on } })
	}
}

export function favicon(val?: string, isEvent?: true) {
	function createFavicon(emoji?: string) {
		const svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="85">${emoji}</text></svg>`
		const defaulticon = '/src/assets/' + (BROWSER === 'edge' ? 'monochrome.png' : 'favicon.ico')
		const domfavicon = document.getElementById('favicon') as HTMLLinkElement

		domfavicon.href = emoji ? svg : defaulticon
	}

	if (isEvent) {
		const isEmoji = val?.match(/\p{Emoji}/gu) && !val?.match(/[0-9a-z]/g)
		eventDebounce({ favicon: isEmoji ? val : '' })
		document.getElementById('head-favicon')?.remove()
	}

	if (BROWSER === 'firefox') {
		setTimeout(() => createFavicon(val), 0)
	} else {
		createFavicon(val)
	}
}

export function tabTitle(val = '', isEvent?: true) {
	document.title = stringMaxSize(val, 80) || tradThis('New tab')

	if (isEvent) {
		eventDebounce({ tabtitle: stringMaxSize(val, 80) })
	}
}

export function pageControl(val: { width?: number; gap?: number }, isEvent?: true) {
	if (val.width) {
		document.documentElement.style.setProperty('--page-width', (val.width ?? SYNC_DEFAULT.pagewidth) + 'px')
		if (isEvent) eventDebounce({ pagewidth: val.width })
	}

	if (typeof val.gap === 'number') {
		document.documentElement.style.setProperty('--page-gap', (val.gap ?? SYNC_DEFAULT.pagegap) + 'em')
		if (isEvent) eventDebounce({ pagegap: val.gap })
	}
}

export function initBackground(data: Sync, local: Local) {
	const type = data.background_type || 'unsplash'
	const blur = data.background_blur
	const brightness = data.background_bright

	backgroundFilter({ blur, brightness })

	type === 'local' ? localBackgrounds() : unsplashBackgrounds({ unsplash: data.unsplash, cache: local.unsplashCache })
}

export function imgBackground(url: string, color?: string) {
	let img = new Image()

	img.onload = () => {
		const bgoverlay = document.getElementById('background_overlay') as HTMLDivElement
		const bgfirst = document.getElementById('background') as HTMLDivElement
		const bgsecond = document.getElementById('background-bis') as HTMLDivElement
		const loadBis = bgfirst.style.opacity === '1'
		const bgToChange = loadBis ? bgsecond : bgfirst

		bgfirst.style.opacity = loadBis ? '0' : '1'
		bgToChange.style.backgroundImage = `url(${url})`

		bgoverlay.style.opacity = '1'

		if (color && BROWSER === 'safari') {
			document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
			setTimeout(() => document.documentElement.style.setProperty('--average-color', color), 400)
		}
	}

	img.src = url
	img.remove()
}

export function backgroundFilter({ blur, brightness, isEvent }: { blur?: number; brightness?: number; isEvent?: true }) {
	const hasbright = typeof brightness === 'number'
	const hasblur = typeof blur === 'number'

	if (hasblur) document.documentElement.style.setProperty('--background-blur', blur.toString() + 'px')
	if (hasbright) document.documentElement.style.setProperty('--background-brightness', brightness.toString())

	if (isEvent && hasblur) eventDebounce({ background_blur: blur })
	if (isEvent && hasbright) eventDebounce({ background_bright: brightness })
}

export function darkmode(value: 'auto' | 'system' | 'enable' | 'disable', isEvent?: boolean) {
	if (isEvent) {
		storage.sync.set({ dark: value })
	}

	if (value === 'auto') {
		const now = Date.now()
		const { sunrise, sunset } = suntime
		const choice = now <= sunrise || now > sunset ? 'dark' : 'light'
		document.documentElement.dataset.theme = choice
	}

	if (value === 'disable') document.documentElement.dataset.theme = 'light'
	if (value === 'enable') document.documentElement.dataset.theme = 'dark'
	if (value === 'system') document.documentElement.dataset.theme = ''
}

export function showPopup(value: string | number) {
	//
	function affiche() {
		const popup = document.getElementById('popup') as HTMLElement

		const reviewURLs = {
			chrome: 'https://chrome.google.com/webstore/detail/bonjourr-%C2%B7-minimalist-lig/dlnejlppicbjfcfcedcflplfjajinajd/reviews',
			firefox: 'https://addons.mozilla.org/en-US/firefox/addon/bonjourr-startpage/',
			safari: 'https://apps.apple.com/fr/app/bonjourr-startpage/id1615431236',
			edge: 'https://microsoftedge.microsoft.com/addons/detail/bonjourr/dehmmlejmefjphdeoagelkpaoolicmid',
			other: 'https://bonjourr.fr/help#%EF%B8%8F-reviews',
		}

		function closePopup(e: Event) {
			const isDesc = (e.target as HTMLElement)?.id === 'popup_text'

			if (isDesc) {
				popup?.classList.remove('shown')
				setTimeout(() => popup?.remove(), 200)
				setTimeout(() => document.getElementById('creditContainer')?.classList.add('shown'), 600)
			}

			storage.sync.set({ reviewPopup: 'removed' })
		}

		popup.style.display = 'flex'
		document.getElementById('popup_review')?.setAttribute('href', reviewURLs[BROWSER])
		document.getElementById('popup_review')?.addEventListener('mousedown', closePopup)
		document.getElementById('popup_donate')?.addEventListener('mousedown', closePopup)
		document.getElementById('popup_text')?.addEventListener('click', closePopup, { passive: true })

		setTimeout(() => popup?.classList.add('shown'), 400)
		setTimeout(() => document.getElementById('creditContainer')?.classList.remove('shown'), 0)
	}

	// TODO: condition a verifier

	if (typeof value === 'number') {
		if (value > 30) affiche() // s'affiche après 30 tabs
		else storage.sync.set({ reviewPopup: value + 1 })

		return
	}

	if (value !== 'removed') {
		storage.sync.set({ reviewPopup: 0 })
	}
}

export function textShadow(init: number | null, event?: number) {
	const val = init ?? event
	document.documentElement.style.setProperty('--text-shadow-alpha', (val ?? 0.2)?.toString())

	if (typeof event === 'number') {
		eventDebounce({ textShadow: val })
	}
}

export function customCss(init: string | null, event?: { is: 'styling' | 'resize'; val: string | number }) {
	const styleHead = document.getElementById('styles') as HTMLStyleElement

	if (init) {
		styleHead.textContent = init
	}

	if (event) {
		switch (event.is) {
			case 'styling': {
				if (typeof event.val === 'string') {
					const val = stringMaxSize(event.val, 8080)
					styleHead.textContent = val
					eventDebounce({ css: val })
				}
				break
			}

			case 'resize': {
				if (typeof event.val === 'number') {
					eventDebounce({ cssHeight: event.val })
				}
				break
			}
		}
	}
}

export function canDisplayInterface(cat: keyof typeof functionsLoad | null, init?: Sync) {
	//
	// Progressive anim to max of Bonjourr animation time
	function displayInterface() {
		let loadtime = Math.min(performance.now() - loadtimeStart, 400)

		if (loadtime < 33) {
			loadtime = 0
		}

		document.documentElement.style.setProperty('--load-time-transition', loadtime + 'ms')
		document.body.classList.remove('loading')

		setTimeout(() => {
			document.body.classList.remove('init')
			settingsInit()
		}, loadtime + 100)
	}

	// More conditions if user is using advanced features
	if (init || !cat) {
		if (init?.font?.family) functionsLoad.fonts = 'Waiting'
		if (init?.quotes?.on) functionsLoad.quotes = 'Waiting'
		return
	}

	if (functionsLoad[cat] === 'Off') {
		return // Function is not activated, don't wait for it
	}

	functionsLoad[cat] = 'Ready'

	const noSettings = !document.getElementById('settings')
	const noWait = Object.values(functionsLoad).includes('Waiting') === false

	if (noWait && noSettings) {
		displayInterface()
	}
}

function onlineAndMobileHandler() {
	if (IS_MOBILE) {
		let visibilityHasChanged = false

		// For Mobile that caches pages for days
		document.addEventListener('visibilitychange', async () => {
			if (visibilityHasChanged === false) {
				visibilityHasChanged = true
				return
			}

			visibilityHasChanged = false

			const data = await storage.sync.get()
			const local = await storage.local.get(['unsplashCache', 'lastWeather'])

			if (!data?.clock || !data?.weather) {
				return
			}

			const frequency = freqControl.get(data.unsplash.every, data.unsplash.time)
			const needNewImage = data.background_type === 'unsplash' && frequency

			if (needNewImage && data.unsplash) {
				unsplashBackgrounds({ unsplash: data.unsplash, cache: local.unsplashCache })
			}

			clock(data)
			weather({ sync: data, lastWeather: local.lastWeather })
		})
	}

	// Only on Online / Safari
	if (PLATFORM === 'online') {
		//
		// Update export code on localStorage changes

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js')
		}

		// PWA install trigger (30s interaction default)
		let promptEvent
		window.addEventListener('beforeinstallprompt', function (e) {
			promptEvent = e
			return promptEvent
		})

		// Firefox cannot -moz-fill-available with height
		// On desktop, uses fallback 100vh
		// On mobile, sets height dynamically because vh is bad on mobile
		if (BROWSER === 'firefox' && IS_MOBILE) {
			const appHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
			appHeight()

			// Resize will crush page when keyboard opens
			// window.addEventListener('resize', appHeight)

			// Fix for opening tabs Firefox iOS
			if (SYSTEM_OS === 'ios') {
				let globalID: number

				function triggerAnimationFrame() {
					appHeight()
					globalID = requestAnimationFrame(triggerAnimationFrame)
				}

				window.requestAnimationFrame(triggerAnimationFrame)
				setTimeout(() => cancelAnimationFrame(globalID), 500)
			}
		}

		if (BROWSER === 'safari' && SYSTEM_OS === 'ios') {
			onSettingsLoad(() => {
				const settingsDom = document.getElementById('settings') as HTMLElement

				document.querySelectorAll('input[type="text"], input[type="url"], textarea')?.forEach((input) => {
					input.addEventListener('focus', () => {
						if (dominterface && settingsDom) {
							dominterface.style.touchAction = 'none'
							settingsDom.style.touchAction = 'none'
						}
					})

					input.addEventListener('blur', () => {
						if (dominterface && settingsDom) {
							dominterface.style.removeProperty('touch-action')
							settingsDom.style.removeProperty('touch-action')
						}
					})
				})
			})
		}
	}
}

function initTimeAndMainBlocks(time: boolean, main: boolean) {
	document.getElementById('time')?.classList.toggle('hidden', !time)
	document.getElementById('main')?.classList.toggle('hidden', !main)
}

function startup(data: Sync, local: Local) {
	traduction(null, data.lang)
	canDisplayInterface(null, data)
	suntime.update(local.lastWeather?.sunrise, local.lastWeather?.sunset)
	weather({ sync: data, lastWeather: local.lastWeather })
	customFont(data.font)
	textShadow(data.textShadow)
	favicon(data.favicon)
	tabTitle(data.tabtitle)
	clock(data)
	darkmode(data.dark)
	searchbar(data.searchbar)
	quotes({ sync: data, local })
	showPopup(data.reviewPopup)
	notes(data.notes || null)
	moveElements(data.move)
	customCss(data.css)
	hideElements(data.hide)
	initBackground(data, local)
	quickLinks(data)
	initTimeAndMainBlocks(data.time, data.main)
	pageControl({ width: data.pagewidth, gap: data.pagegap })
}

;(async () => {
	onlineAndMobileHandler()

	try {
		const { sync, local } = await storage.init()
		const version_old = sync?.about?.version
		const isUpdate = version_old !== CURRENT_VERSION

		if (isUpdate) {
			console.log(`Version change: ${version_old} => ${CURRENT_VERSION}`)

			storage.sync.set({
				about: SYNC_DEFAULT.about,
			})
		}

		await setTranslationCache(sync.lang, local, isUpdate)

		startup(sync, local)
	} catch (e) {
		errorMessage(e)
	}
})()
