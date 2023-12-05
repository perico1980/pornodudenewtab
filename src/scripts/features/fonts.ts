import { canDisplayInterface } from '../index'
import storage from '../storage'

import { SYSTEM_OS } from '../defaults'
import { eventDebounce } from '../utils/debounce'
import onSettingsLoad from '../utils/onsettingsload'
import errorMessage from '../utils/errormessage'
import { tradThis } from '../utils/translations'
import { subsets } from '../langs'
import superinput from '../utils/superinput'

import { Font, Sync } from '../types/sync'
import { apiFetch } from '../utils'

interface Fontsource {
	id: string
	family: string
	subsets: string[]
	weights: number[]
	styles: string[]
	defSubset: string
	variable: boolean
	lastModified: string
	category: string
	license: string
	type: 'google' | 'other'
}

type CustomFontUpdate = {
	autocomplete?: true
	lang?: true
	size?: string
	family?: string
	weight?: string
}

const familyInput = superinput('i_customfont')

const systemfont = (function () {
	const fonts = {
		fallback: { placeholder: 'Arial', weights: ['500', '600', '800'] },
		windows: { placeholder: 'Segoe UI', weights: ['300', '400', '600', '700', '800'] },
		android: { placeholder: 'Roboto', weights: ['100', '300', '400', '500', '700', '900'] },
		linux: { placeholder: 'Fira Sans', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
		apple: { placeholder: 'SF Pro Display', weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'] },
	}

	if (SYSTEM_OS === 'windows') return fonts.windows
	else if (SYSTEM_OS === 'android') return fonts.android
	else if (SYSTEM_OS === 'mac') return fonts.apple
	else if (SYSTEM_OS === 'ios') return fonts.apple
	else return fonts.linux
})()

export default async function customFont(init?: Font, event?: CustomFontUpdate) {
	if (event) {
		updateCustomFont(event)
		return
	}

	if (init) {
		try {
			displayFont(init)
			canDisplayInterface('fonts')
			onSettingsLoad(() => initFontSettings(init))
		} catch (e) {
			errorMessage(e)
		}
	}
}

//
//	Updates
//

async function updateCustomFont({ family, weight, size, lang, autocomplete }: CustomFontUpdate) {
	if (autocomplete) {
		setAutocompleteSettings()
		return
	}

	const data = await storage.sync.get('font')

	if (family !== undefined) {
		data.font = await updateFontFamily(data, family)
	}

	if (weight) {
		data.font.weight = weight || '400'
		displayFont(data.font)
	}

	if (size) {
		data.font.size = size
		displayFont(data.font)
	}

	if (lang) {
		handleLangSwitch(data.font)
		return
	}

	eventDebounce({ font: data.font })
}

async function updateFontFamily(data: Sync, family: string): Promise<Font> {
	const i_customfont = document.getElementById('i_customfont') as HTMLInputElement
	const i_weight = document.getElementById('i_weight') as HTMLInputElement

	const familyType = family.length == 0 ? 'none' : systemFontChecker(family) ? 'system' : 'fontsource'

	let font: Font = {
		family: '',
		size: data.font.size,
		weight: SYSTEM_OS === 'windows' ? '400' : '300',
		weightlist: systemfont.weights,
	}

	switch (familyType) {
		case 'none': {
			displayFont(font)
			i_customfont.value = ''
			i_customfont.placeholder = systemfont.placeholder
			break
		}

		case 'system': {
			familyInput.load()
			font.family = family
			displayFont(font)
			familyInput.toggle(false, family)
			break
		}

		case 'fontsource': {
			familyInput.load()

			const newfont = await getNewFont(font, family)

			if (newfont && navigator.onLine) {
				font = { ...font, ...newfont }
				displayFont(font)

				await waitForFontLoad(family)
				familyInput.toggle(false, family)
			}

			if (font.family === '') {
				familyInput.warn(`Cannot load "${family}"`)
				return data.font
			}
			break
		}
	}

	setWeightSettings(font.weightlist)
	i_weight.value = font.weight

	return font
}

async function handleLangSwitch(font: Font) {
	const noCustomOrSystemFont = !font.family //|| systemFontChecker(font.family) TODODODOODO

	if (noCustomOrSystemFont) {
		return
	}

	const newfont = await getNewFont(font, font.family)

	// remove font if not available with subset
	if (newfont === undefined) {
		updateCustomFont({ family: '' })
		return
	}

	font.family = newfont.family
	font.weight = newfont.weight
	font.weightlist = newfont.weightlist

	displayFont(font)
	setAutocompleteSettings(true)
}

async function getNewFont(font: Font, newfamily: string): Promise<Font | undefined> {
	const fontlist = (await (await apiFetch('/fonts'))?.json()) ?? []
	let newfont: Fontsource | undefined

	for (const item of fontlist as Fontsource[]) {
		const hasCorrectSubset = item.subsets.includes(getRequiredSubset())
		const isFamily = item.family.toLowerCase() === newfamily.toLowerCase()

		if (hasCorrectSubset && isFamily) {
			newfont = item
		}
	}

	if (newfont) {
		font.weight = '400'
		font.family = newfamily
		font.weightlist = newfont.weights.map((w) => w.toString())
		return font
	}

	// this undefined return is important
	// we need to know when no font is found
	return
}

function displayFont({ family, size, weight }: Font) {
	// Weight: default bonjourr lowers font weight on clock (because we like it)
	const clockWeight = parseInt(weight) > 100 ? systemfont.weights[systemfont.weights.indexOf(weight) - 1] : weight
	const subset = getRequiredSubset()
	const id = family.toLocaleLowerCase().replaceAll(' ', '-')

	let fontface = `
		@font-face {font-family: "${family}";
			src: url(https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-${weight}-normal.woff2) format('woff2');
		}
	`

	if (subset !== 'latin') {
		fontface += fontface.replace('latin', subset)
	}

	document.getElementById('fontface')!.textContent += fontface

	document.documentElement.style.setProperty('--font-family', family ? `"${family}"` : null)
	document.documentElement.style.setProperty('--font-size', parseInt(size) / 16 + 'em')
	document.documentElement.style.setProperty('--font-weight', weight)
	document.documentElement.style.setProperty('--font-weight-clock', family ? weight : clockWeight)
}

//
//	Settings options
//

async function initFontSettings(font?: Font) {
	const settings = document.getElementById('settings') as HTMLElement
	const hasCustomWeights = font && font.weightlist.length > 0
	const weights = hasCustomWeights ? font.weightlist : systemfont.weights
	const family = font?.family || systemfont.placeholder

	settings.querySelector('#i_customfont')?.setAttribute('placeholder', family)

	setWeightSettings(weights)

	if (font?.family) {
		setAutocompleteSettings()
	}
}

async function setAutocompleteSettings(isLangSwitch?: boolean) {
	const dl_fontfamily = document.querySelector<HTMLDataListElement>('#dl_fontfamily')

	if (isLangSwitch) {
		dl_fontfamily?.childNodes.forEach((node) => node.remove())
	}

	if (dl_fontfamily?.childElementCount === 0) {
		const fontlist = (await (await apiFetch('/fonts'))?.json()) ?? []
		const fragment = new DocumentFragment()
		const requiredSubset = getRequiredSubset()

		for (const item of fontlist as Fontsource[]) {
			if (item.subsets.includes(requiredSubset)) {
				const option = document.createElement('option')
				option.textContent = item.family
				option.value = item.family
				fragment.appendChild(option)
			}
		}

		dl_fontfamily?.appendChild(fragment)
	}
}

function setWeightSettings(weights: string[]) {
	const options = document.querySelectorAll<HTMLOptionElement>('#i_weight option')

	for (const option of options) {
		option.classList.toggle('hidden', weights.includes(option.value) === false)
	}
}

//
//	Helpers
//

function systemFontChecker(family: string): boolean {
	// Needs a special method to detect system fonts.
	// Because of fingerprinting concerns,
	// Firefox and safari made fonts.check() useless

	const p = document.createElement('p')
	p.setAttribute('style', 'position: absolute; opacity: 0; font-family: invalid font;')
	p.textContent = 'mqlskdjfhgpaozieurytwnxbcv?./,;:1234567890' + tradThis('New tab')
	document.getElementById('interface')?.prepend(p)

	const first_w = p.getBoundingClientRect().width
	p.style.fontFamily = `'${family}'`

	const second_w = p.getBoundingClientRect().width
	const hasLoadedFont = first_w !== second_w

	p.remove()

	return hasLoadedFont
}

async function waitForFontLoad(family: string): Promise<Boolean> {
	return new Promise((resolve) => {
		let limitcounter = 0
		let hasLoadedFont = systemFontChecker(family)
		let interval = setInterval(() => {
			if (hasLoadedFont || limitcounter === 100) {
				clearInterval(interval)
				return resolve(true)
			} else {
				hasLoadedFont = systemFontChecker(family)
				limitcounter++
			}
		}, 100)
	})
}

function getRequiredSubset(): string {
	const lang = document.documentElement.getAttribute('lang') ?? 'en'
	let subset = 'latin'

	if (lang in subsets) {
		subset = subsets[lang as keyof typeof subsets]
	}

	return subset
}
