import { getSelectedIds, getLink, getDefaultIcon, createTitle } from './helpers'
import { IS_MOBILE, SYSTEM_OS } from '../../defaults'
import { stringMaxSize } from '../../utils'
import { linksUpdate } from '.'
import onSettingsLoad from '../../utils/onsettingsload'
import transitioner from '../../utils/transitioner'
import storage from '../../storage'

const domlinkblocks = document.getElementById('linkblocks') as HTMLDivElement
const domeditlink = document.getElementById('editlink') as HTMLDialogElement
const domtitle = document.getElementById('e_title') as HTMLInputElement
const domurl = document.getElementById('e_url') as HTMLInputElement
const domicon = document.getElementById('e_iconurl') as HTMLInputElement

//
// Display
//

export default async function openEditDialog(event: Event) {
	if (event.type === 'keyup' && (event as KeyboardEvent).code !== 'KeyE') {
		return
	}

	document.dispatchEvent(new Event('stop-select-all'))
	event.preventDefault()

	const selected = document.querySelectorAll('#linkblocks li.selected')

	domurl.value = ''
	domicon.value = ''
	domtitle.value = ''

	//
	// Set correct state

	const isSelectAll = domlinkblocks.classList.contains('select-all')
	const isInFolder = domlinkblocks.classList.contains('in-folder')
	const path = event.composedPath() as Element[]
	const isTab = path.some((el) => el?.id === 'link-title')
	const isTabItem = path[0]?.tagName === 'BUTTON' && path[1]?.id === 'tab-title'
	const isTabDefault = isTabItem && path[0]?.id === 'default-tab-title'
	const isOnLink = path.some((el) => el?.className?.includes('block') && el?.tagName === 'LI')
	const isOnLinkFolder = isOnLink && path.some((el) => el?.classList?.contains('folder'))
	const isOnLinklist = path[0]?.id === 'link-list'

	if ((isInFolder && isTab) || (isSelectAll && selected.length === 0) || domlinkblocks.classList.contains('dragging')) {
		return
	}

	domeditlink?.classList.toggle('select-all', isSelectAll)
	domeditlink?.classList.toggle('in-folder', isInFolder)
	domeditlink?.classList.toggle('on-linklist', isOnLinklist)
	domeditlink?.classList.toggle('on-link', isOnLink)
	domeditlink?.classList.toggle('on-link-folder', isOnLinkFolder)
	domeditlink?.classList.toggle('on-tabtitle', isTab)
	domeditlink?.classList.toggle('on-tab', isTabItem)
	domeditlink?.classList.toggle('on-tab-default', isTabDefault)

	//
	// Init inputs and side effects (lol)

	const data = await storage.sync.get()

	if (isTabItem) {
		const button = path[0]
		const buttons = [...document.querySelectorAll<HTMLDivElement>('#tab-title button')]
		const index = buttons.findIndex((node) => node === button)

		domeditlink.dataset.tabIndex = index.toString()
		domtitle.value = data.linktabs.titles[index] ?? ''
	}

	if (isOnLink) {
		const pathLis = path.filter((el) => el.tagName === 'LI')
		const li = pathLis[0]
		const id = li?.id
		const link = getLink(data, id)

		li?.classList.add('selected')

		domtitle.value = link?.title ?? ''

		if (!link?.folder) {
			domurl.value = link?.url ?? ''
			domicon.value = link?.icon ?? ''
		}
	}

	//
	// Display

	const contextmenuTransition = transitioner()
	contextmenuTransition.first(() => domeditlink?.show())
	contextmenuTransition.then(async () => domeditlink?.classList?.add('shown'))
	contextmenuTransition.transition(10)

	const { x, y } = newEditDialogPosition(event)
	domeditlink.style.transform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px)`
	domtitle?.focus()
}

function newEditDialogPosition(event: Event): { x: number; y: number } {
	const editRects = domeditlink.getBoundingClientRect()
	const { innerHeight, innerWidth } = window

	let x = 0
	let y = 0

	if (event.type === 'touchstart') {
		return { x, y }
	}
	//
	else if (event.type === 'contextmenu' || event.type === 'click') {
		x = (event as PointerEvent).x + 20
		y = (event as PointerEvent).y + 20
	}
	//
	else if (event.type === 'keyup' && (event as KeyboardEvent)?.key === 'e') {
		x = (event.target as HTMLElement).offsetLeft
		y = (event.target as HTMLElement).offsetTop
	}

	const w = editRects.width + 30
	const h = editRects.height + 30

	if (x + w > innerWidth) x -= x + w - innerWidth
	if (y + h > innerHeight) y -= h

	return { x, y }
}

//
// Events
//

onSettingsLoad(() => {
	document.addEventListener('close-edit', closeEditDialog)
	document.getElementById('editlink-form')?.addEventListener('submit', submitChanges)
	domlinkblocks?.addEventListener('contextmenu', openEditDialog)

	if (SYSTEM_OS === 'ios' || !IS_MOBILE) {
		window.addEventListener('resize', closeEditDialog)
	}
})

async function submitChanges(event: SubmitEvent) {
	switch (event.submitter?.id) {
		case 'eb_inputs': {
			applyLinkChanges('inputs')
			event.preventDefault()
			return
		}

		case 'eb_delete-selected':
		case 'eb_delete-link':
			deleteSelection()
			break

		case 'eb_submit-changes':
			applyLinkChanges('button')
			break

		case 'eb_add-link':
			addLinkFromEditDialog()
			break

		case 'eb_add-folder':
			addSelectionToNewFolder()
			break

		case 'eb_remove-folder':
			removeSelectionFromFolder()
			break

		case 'eb_add-tab':
			addTab()
			break

		case 'eb_delete-tab':
			deleteTab()
			break
	}

	event.preventDefault()
	setTimeout(closeEditDialog)
}

async function applyLinkChanges(origin: 'inputs' | 'button') {
	const id = getSelectedIds()[0]
	const li = document.querySelector<HTMLLIElement>(`#${id}`)
	const isOnTab = domeditlink.classList.contains('on-tabtitle')
	const isOnTabItem = domeditlink.classList.contains('on-tab')
	const inputs = document.querySelectorAll<HTMLInputElement>('#editlink input')

	if (isOnTabItem) {
		changeTabTitle()
		closeEditDialog()
		return
	}
	//
	else if (isOnTab) {
		addTab()
		closeEditDialog()
		return
	}
	//
	else if (!id && domeditlink.classList.contains('on-linklist')) {
		addLinkFromEditDialog()
		closeEditDialog()
		return
	}

	if (!id || !li) {
		return
	}

	if (origin === 'inputs') {
		inputs.forEach((node) => node.blur())
	}

	const data = await storage.sync.get(id)
	const link = data[id] as Links.Link

	const title = {
		val: document.querySelector<HTMLInputElement>('#e_title')?.value,
		dom: document.querySelector<HTMLSpanElement>(`#${id} span`),
	}

	const url = {
		val: document.querySelector<HTMLInputElement>('#e_url')?.value,
		dom: document.querySelector<HTMLAnchorElement>(`#${id} a`),
	}

	const icon = {
		val: document.querySelector<HTMLInputElement>('#e_iconurl')?.value,
		dom: document.querySelector<HTMLImageElement>(`#${id} img`),
	}

	if (title.dom && title.val !== undefined) {
		link.title = stringMaxSize(title.val, 64)
		title.dom.textContent = link.title
	}

	if (!link.folder) {
		if (icon.dom) {
			link.icon = icon.val ? stringMaxSize(icon.val, 7500) : undefined
			icon.dom.src = link.icon ?? getDefaultIcon(link.url)
		}

		if (title.dom && url.dom && url.val !== undefined) {
			link.url = stringMaxSize(url.val, 512)
			url.dom.href = link.url
			title.dom.textContent = createTitle(link)
		}
	}

	storage.sync.set({ [id]: link })
}

function changeTabTitle() {
	linksUpdate({
		tabTitle: {
			title: domtitle.value,
			index: parseInt(domeditlink.dataset.tabIndex ?? '0'),
		},
	})
}

function addTab() {
	linksUpdate({ addTab: domtitle.value })
}

function deleteTab() {
	linksUpdate({ deleteTab: parseInt(domeditlink.dataset.tabIndex ?? '0') })
}

function addLinkFromEditDialog() {
	linksUpdate({
		addLink: {
			title: domtitle.value,
			url: domurl.value,
		},
	})
}

function addSelectionToNewFolder() {
	linksUpdate({ addFolder: getSelectedIds() })
	document.dispatchEvent(new Event('remove-select-all'))
}

function deleteSelection() {
	linksUpdate({ deleteLinks: getSelectedIds() })
}

function removeSelectionFromFolder() {
	linksUpdate({ removeFromFolder: getSelectedIds() })
	document.dispatchEvent(new Event('remove-select-all'))
}

function closeEditDialog() {
	if (domeditlink.open) {
		document.querySelectorAll('.block.selected').forEach((block) => block?.classList.remove('selected'))
		domeditlink.removeAttribute('data-tab-index')
		domeditlink.classList.remove('shown')
		domeditlink.close()
	}
}