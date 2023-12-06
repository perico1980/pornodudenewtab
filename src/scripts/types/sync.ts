import { UnsplashImage } from './local'

export type Clock = {
	ampm: boolean
	analog: boolean
	seconds: boolean
	style: string
	timezone: string
	face: string
	size: number
}

export type Searchbar = {
	on: boolean
	opacity: number
	newtab: boolean
	engine: string
	request: string
	suggestions: boolean
	placeholder: string
}

export type Quotes = {
	on: boolean
	author: boolean
	last: number
	type: string
	frequency: string
	userlist?: [string, string][]
}

export type Weather = {
	geolocation: 'precise' | 'approximate' | 'off'
	ccode?: string
	city?: string
	unit: 'metric' | 'imperial'
	location?: [number, number]
	forecast: string
	temperature: string
	moreinfo?: string
	provider?: string
}

export type Unsplash = {
	time: number
	every: string
	collection: string
	pausedImage: UnsplashImage | null
	lastCollec: 'night' | 'noon' | 'day' | 'evening' | 'user'
}

export type Font = {
	family: string
	size: string
	weight: string
	weightlist: string[]
	system?: boolean
	// <1.19
	url?: string
	availWeights?: string[]
}

export type Notes = {
	on: boolean
	text: string | null
	width?: number
	opacity: number
	align: 'left' | 'center' | 'right'
}

export type MoveKeys = 'time' | 'main' | 'notes' | 'searchbar' | 'quicklinks' | 'quotes'

export type MoveItem = {
	box: string
	text: string
}

export type Move = {
	selection: keyof Move['layouts']
	layouts: {
		single: {
			grid: [string][]
			items: { [key in MoveKeys]?: MoveItem }
		}
		double: {
			grid: [string, string][]
			items: { [key in MoveKeys]?: MoveItem }
		}
		triple: {
			grid: [string, string, string][]
			items: { [key in MoveKeys]?: MoveItem }
		}
	}
}

export type HideOld = [[number, number], [number, number, number], [number], [number]]

export type Hide = {
	clock?: boolean
	date?: boolean
	greetings?: boolean
	weatherdesc?: boolean
	weathericon?: boolean
	settingsicon?: boolean
}

export type Sync = {
	usdate: boolean
	showall: boolean
	quicklinks: boolean
	time: boolean
	main: boolean
	pagegap: number
	pagewidth: number
	linksrow: number
	linkstyle: string
	linknewtab: boolean
	cssHeight: number
	reviewPopup: number
	background_blur: number
	background_bright: number
	css: string
	lang: string
	favicon: string
	tabtitle: string
	greeting: string
	notes?: Notes
	hide?: Hide
	dark: 'auto' | 'system' | 'enable' | 'disable'
	background_type: 'local' | 'unsplash'
	clock: Clock
	unsplash: Unsplash
	weather: Weather
	searchbar: Searchbar
	quotes: Quotes
	font: Font
	move: Move
	textShadow: number
	about: { browser: string; version: string }
	[key: string]: Link | unknown
}
