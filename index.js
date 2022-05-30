// @ts-check
{
    const BASE = '/sp'
    const DAY = 24 * 60 * 60 * 1000

    /** @param {ConstructorParameters<DateConstructor>[0]} date */
    const toISO = (date) => {
        const d = new Date(date)
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d
            .getDate()
            .toString()
            .padStart(2, '0')}`
    }

    /** @param {string} str */
    const capitalize = (str) => str[0].toLocaleUpperCase() + str.slice(1)

    const getWeekBounds = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const day = new Date().getDay()

        const startOfWeek = new Date(day ? today.getTime() - DAY * (day - 1) : today.getTime() + DAY)
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * DAY)

        return { startOfWeek, endOfWeek }
    }

    /**
     * @typedef {object} Lesson
     * @property {string} name
     * @property {string} time
     * @property {string} location
     */

    /**
     * @typedef {object} TimetableItemParams
     * @property {string} day
     * @property {Lesson[]} lessons
     */

    const lessonItemTemplate = document.querySelector('template[data-lesson-item-template]')
    /** @param {Lesson} lesson */
    const createLessonItem = ({ name, time, location }) => {
        if (!lessonItemTemplate || !(lessonItemTemplate instanceof HTMLTemplateElement)) {
            console.warn('Lesson item template element was not found or it is not a template')
            return
        }

        const content = /** @type {DocumentFragment} */ (lessonItemTemplate.content.cloneNode(true))
        content.querySelector('.time').innerHTML = time
        content.querySelector('.name').innerHTML = capitalize(name)
        content.querySelector('.location').innerHTML = capitalize(location)

        return content
    }

    const timetableItemTemplate = document.querySelector('template[data-timetable-item-template]')
    /** @param {TimetableItemParams} params */
    const createTimetableItem = ({ day, lessons }) => {
        if (!timetableItemTemplate || !(timetableItemTemplate instanceof HTMLTemplateElement)) {
            console.warn('Timetable item template element was not found or it is not a template')
            return
        }

        const content = /** @type {DocumentFragment} */ (timetableItemTemplate.content.cloneNode(true))
        content.querySelector('.day').innerHTML = capitalize(day)

        const lessonsContainer = content.querySelector('.lessons')
        for (const lesson of lessons) {
            lessonsContainer.appendChild(createLessonItem(lesson))
        }

        return content
    }

    // Pages
    {
        const mobileDocumentTitle = document.getElementById('mobile-title')
        if (!mobileDocumentTitle) {
            console.warn('Mobile document title element was not found')
        }

        const content = document.getElementById('content')
        if (!content) {
            console.warn('Content element was not found')
        }

        const pageHandlers = {
            timetable() {
                const container = document.querySelector('[data-timetable-container]')
                if (!container) {
                    console.warn('Container for timetable was not found')
                    return
                }

                let isLoading = false
                const loadTimetable = async () => {
                    if (isLoading) return

                    container.classList.remove('loaded')

                    const { startOfWeek, endOfWeek } = getWeekBounds()
                    let timetable
                    try {
                        isLoading = true
                        const response = await fetch(
                            `https://timetable.spbu.ru/api/v1/educators/2634/events/${toISO(startOfWeek)}/${toISO(
                                endOfWeek
                            )}`
                        )

                        if (!response.ok) {
                            return container.classList.add('error')
                        }

                        timetable = await response.json()
                    } catch (e) {
                        return container.classList.add('error')
                    } finally {
                        isLoading = false
                        container.classList.add('loaded')
                    }

                    container.classList.remove('error')
                    for (const event of timetable.EducatorEventsDays) {
                        container.appendChild(
                            createTimetableItem({
                                day: event.DayString,
                                lessons: event.DayStudyEvents.map(
                                    ({ Subject: name, TimeIntervalString: time, LocationsDisplayText: location }) => ({
                                        name,
                                        time,
                                        location,
                                    })
                                ),
                            })
                        )
                    }
                }

                loadTimetable()
                document.querySelectorAll('button[data-reload-timetable]').forEach((button) => {
                    button.addEventListener('click', loadTimetable)
                })
            },
        }

        const initialLocation = localStorage.getItem('path') || window.location.pathname

        let initialized = false
        /** @param {HTMLTemplateElement} template */
        const initializePage = (template) => {
            const pageId = template.dataset.page
            const historyEntry = `${BASE}/${template.dataset.url ?? pageId}`
            const documentTitle = template.dataset.title

            if (!documentTitle) {
                console.warn(`No title for page "${pageId}"`)
            }

            const updatePage = () => {
                if (mobileDocumentTitle) {
                    mobileDocumentTitle.innerText = documentTitle
                }

                document.body.className = `page-${pageId}`
                document.title = documentTitle

                if (content) {
                    content.replaceChildren(template.content.cloneNode(true))
                }

                if (pageId in pageHandlers) {
                    pageHandlers[pageId]()
                }
            }

            if (initialLocation === historyEntry) {
                initialized = true
                updatePage()
            }

            document.addEventListener('click', (event) => {
                if (event.shiftKey || event.metaKey || event.ctrlKey) {
                    return
                }

                /** @type {any} */
                let node = event.target
                while (
                    node &&
                    (!(node instanceof HTMLAnchorElement) || !`${BASE}${node.href}`.endsWith(historyEntry))
                ) {
                    node = node.parentNode
                }

                if (node) {
                    event.preventDefault()
                    updatePage()
                    history.pushState('', '', historyEntry)
                }
            })
        }

        /** @type {NodeListOf<HTMLTemplateElement>} */
        const templates = document.querySelectorAll('template[data-page]')
        templates.forEach(initializePage)

        if (!initialized) {
            window.location.href = `${BASE}/home`
        }
    }

    // Mobile navbar
    {
        const toggle = document.getElementById('navigation-toggle')

        if (!toggle) {
            console.warn('Navigation toggle was not found')
        } else {
            toggle.addEventListener('click', () => {
                document.body.classList.toggle('navigation-open')
            })
        }

        const menu = document.getElementById('navigation-menu')
        if (!menu) {
            console.warn('Navigation menu was not found')
        } else {
            menu.style.setProperty('--expanded-height', `${menu.scrollHeight}px`)
        }
    }
}
