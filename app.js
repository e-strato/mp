// Malina Property — поведение сайта. Без зависимостей; каждый кусок молчит, если его блока нет на странице.
// Поведение — как у malinaproperty.ru (CONTRIBUTING.md §2): шапка при скролле, бургер ≤ 767, карусели по ширине.
(function () {
  'use strict'
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const mobile = matchMedia('(max-width: 767px)')
  const still = matchMedia('(prefers-reduced-motion: reduce)')

  // Заглушки href="#" (меню, футер, соцсети — решение 5): нажимаются, но страница не прыгает наверх
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#"]')
    if (a) e.preventDefault()
  })

  // Слои поверх страницы (.layer — окна): плавно появляются и исчезают; пока открыт хоть один — страница не прокручивается
  const layerToggle = (el, on) => {
    clearTimeout(el.hideTimer)
    if (on) {
      el.hidden = false
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')))
    } else {
      el.classList.remove('is-in')
      el.hideTimer = setTimeout(() => (el.hidden = true), still.matches ? 0 : 250)
    }
    document.documentElement.style.overflow = on || $$('.layer.is-in').some((l) => l !== el) ? 'hidden' : ''
  }

  // Состояние страницы по ссылке: ?manager=no — «без менеджера» (Figma «Задача 1»), по умолчанию — с менеджером
  const params = new URLSearchParams(location.search)
  document.documentElement.dataset.manager = params.get('manager') === 'no' ? 'no' : 'yes'

  // [Шапка] Тень после 48px прокрутки (живой сайт: minY = 48)
  const header = $('#header')
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 48)
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  }

  // [Шапка] Бургер — мобильное меню на весь экран
  const menuBtn = $('.menu-btn')
  const menu = $('#mobile-menu')
  if (menuBtn && menu) {
    const toggle = (open) => {
      menu.classList.toggle('is-open', open)
      menuBtn.setAttribute('aria-expanded', String(open))
      document.body.style.overflow = open ? 'hidden' : ''
    }
    menuBtn.addEventListener('click', () => toggle(!menu.classList.contains('is-open')))
    $('.js-menu-close', menu).addEventListener('click', () => toggle(false))
    // «Подбор объекта» из меню: меню закрываем, окно открывается поверх
    $$('[data-modal]', menu).forEach((b) => b.addEventListener('click', () => toggle(false)))
  }

  // [Избранное] Как на сайте (решение 6): закладка браузера — подсказка про CTRL-D
  $$('.js-favorite').forEach((b) => b.addEventListener('click', () => alert('Нажмите CTRL-D, чтобы добавить страницу в закладки.')))

  // [Футер] Год — текущий
  $$('.js-year').forEach((el) => (el.textContent = new Date().getFullYear()))

  // [Баннер] «Посмотреть на карте» — Яндекс Карты в новой вкладке, поиск по адресу объекта (в окне подборки — адрес из окна)
  $$('.js-map').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault()
      const address = $('#object-title .address', a.closest('.sheet') || document)?.textContent || ''
      open('https://yandex.ru/maps/?text=' + encodeURIComponent(address), '_blank', 'noopener')
    }),
  )

  // [Объект] Правая колонка прилипает: отступ 120 (в окне подборки — 24); выше экрана — прилипает низом
  $$('#object-main .col-right').forEach((col) => {
    const base = col.closest('#sel-modal') ? 24 : 120
    const view = () => (col.closest('#sel-modal')?.clientHeight || innerHeight)
    const set = () => col.style.setProperty('--sticky-top', Math.min(base, view() - col.offsetHeight - 16) + 'px')
    new ResizeObserver(set).observe(col)
    addEventListener('resize', set)
  })

  // [Лента] Слайдер со сдвигом, как Owl Carousel на сайте: стрелки, свайп пальцем и мышью, loop — по кругу (клоны по краям).
  // view — окно с overflow: hidden, внутри .js-slides; per() — сколько видно; onChange(i) — после смены. Возвращает { go, index, rebuild }.
  const slider = (view, { loop = false, gap = 0, per = () => 1, onChange = () => {} } = {}) => {
    const track = $('.js-slides', view)
    let items, n, i = 0, dx = 0
    const offset = () => (loop ? n : 0)
    const step = () => (items[0] ? items[0].getBoundingClientRect().width + gap : 0)
    const max = () => Math.max(0, n - per())
    const place = (anim) => {
      track.style.transition = anim && !still.matches ? '' : 'none'
      track.style.transform = `translateX(${-(i + offset()) * step() + dx}px)`
    }
    const go = (k, anim = true) => {
      i = loop ? k : Math.min(Math.max(k, 0), max())
      dx = 0
      place(anim)
      onChange(((i % n) + n) % n)
    }
    const rebuild = () => {
      $$('[data-clone]', track).forEach((c) => c.remove())
      items = [...track.children]
      n = items.length
      if (loop && n) {
        const clone = (el) => Object.assign(el.cloneNode(true), { inert: true }), mark = (el) => (el.dataset.clone = '', el)
        items.forEach((el) => track.append(mark(clone(el))))
        items.slice().reverse().forEach((el) => track.prepend(mark(clone(el))))
      }
      go(Math.min(i, loop ? n - 1 : max()), false)
    }
    // По кругу: ушли в клоны — после анимации тихо перескакиваем на настоящий слайд
    track.addEventListener('transitionend', () => {
      if (loop && (i < 0 || i >= n)) { i = ((i % n) + n) % n; place(false) }
    })
    // Свайп / перетаскивание мышью; после перетаскивания клик по ссылке внутри гасим
    let x0 = null, moved = false
    view.addEventListener('pointerdown', (e) => {
      moved = false
      if (e.button !== 0 || e.target.closest('button') || e.target.closest('.js-slider-view') !== view) return
      x0 = e.clientX
    })
    addEventListener('pointermove', (e) => {
      if (x0 === null) return
      dx = e.clientX - x0
      if (Math.abs(dx) > 5) { moved = true; view.classList.add('is-dragging') }
      if (moved) place(false)
    })
    addEventListener('pointerup', () => {
      if (x0 === null) return
      x0 = null
      view.classList.remove('is-dragging')
      if (!moved) return
      const shift = Math.abs(dx) > 40 ? Math.max(1, Math.round(Math.abs(dx) / step())) * -Math.sign(dx) : 0
      go(i + shift)
    })
    view.addEventListener('click', (e) => moved && (e.preventDefault(), e.stopPropagation()), true)
    view.addEventListener('dragstart', (e) => e.preventDefault())
    addEventListener('resize', () => place(false))
    rebuild()
    return { go, rebuild, get index() { return ((i % n) + n) % n }, get count() { return n }, get max() { return max() } }
  }

  // [Галерея] Лента фото + миниатюры (без круга, как loop: false на сайте), полный экран — слой с панелью объекта
  const gallery = $('.js-gallery')
  if (gallery) {
    const page = $('.photo', gallery)
    const layer = $('.js-gallery-layer', gallery)
    const full = $('.g-full__photo', layer)
    const pageThumbs = $('.js-thumbs', gallery)
    const fullThumbs = $('.js-thumbs', layer)
    // Слайды строим по миниатюрам (data-src): их подменяет окно подборки под свой объект (событие gallery:reset)
    const fillSlides = (view) => {
      const alt = $('.js-slides img', page)?.alt || ''
      $('.js-slides', view).innerHTML = $$('.thumb', pageThumbs)
        .map((t, k) => `<img src="${t.dataset.src}" alt="${k ? '' : alt}" draggable="false"${k ? ' loading="lazy"' : ''} />`).join('')
    }
    const sync = (view, thumbs, s) => (k) => {
      $$('.thumb', thumbs).forEach((t, j) => t.setAttribute('aria-current', String(j === k)))
      $$('.thumb', thumbs)[k]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      $('.js-prev', view).disabled = k === 0
      $('.js-next', view).disabled = s ? k >= s.count - 1 : false
    }
    fillSlides(page)
    let pageS, fullS
    pageS = slider(page, { onChange: (k) => sync(page, pageThumbs, pageS)(k) })
    pageS.go(0, false)
    const wire = (view, thumbs, s) => {
      $('.js-prev', view).addEventListener('click', () => s().go(s().index - 1))
      $('.js-next', view).addEventListener('click', () => s().go(s().index + 1))
      thumbs.addEventListener('click', (e) => {
        const t = e.target.closest('.thumb')
        if (t) s().go($$('.thumb', thumbs).indexOf(t))
      })
    }
    wire(page, pageThumbs, () => pageS)
    gallery.addEventListener('gallery:reset', () => {
      fillSlides(page)
      pageS.rebuild()
      pageS.go(0, false)
    })

    // Полный экран: панель — копия заголовка объекта из той же страницы/окна; при закрытии лента страницы встаёт на то же фото
    const root = gallery.closest('.sheet') || document
    const openFull = () => {
      $('.js-full-title', layer).textContent = $('#object-title h1', root)?.textContent || ''
      $('.js-full-tag', layer).textContent = $('#object-title .tag__body', root)?.textContent || ''
      $('.js-full-address', layer).textContent = $('#object-title .address', root)?.textContent || ''
      const metro = $('#object-title .metro', root)
      $('.js-full-metro', layer).textContent = metro?.textContent.trim() || ''
      $('.g-full__metro', layer).hidden = !metro || metro.hidden
      $$('.js-torg', layer).forEach((b) => (b.hidden = $('.js-torg', page).hidden))
      fillSlides(full)
      fullThumbs.innerHTML = pageThumbs.innerHTML
      layerToggle(layer, true)
      if (!fullS) {
        fullS = slider(full, { onChange: (k) => sync(full, fullThumbs, fullS)(k) })
        wire(full, fullThumbs, () => fullS)
      } else fullS.rebuild()
      requestAnimationFrame(() => fullS.go(pageS.index, false))
    }
    const closeFull = () => {
      pageS.go(fullS.index, false)
      layerToggle(layer, false)
    }
    $('.js-gallery-full', gallery).addEventListener('click', openFull)
    $('.js-gallery-close', layer).addEventListener('click', closeFull)
    // Клавиши — наше удобство (на сайте нет): Esc закрывает, ← → листают
    addEventListener('keydown', (e) => {
      if (layer.hidden || $('.modal.is-in')) return
      if (e.key === 'Escape') { e.stopImmediatePropagation(); closeFull() }
      if (e.key === 'ArrowLeft') fullS.go(fullS.index - 1)
      if (e.key === 'ArrowRight') fullS.go(fullS.index + 1)
    }, true)
  }

  // [Похожие предложения] Карусель по кругу (Owl loop: true): видно 4 / 3 / 2 / 1, точки — страницы; фото в карточке — своя лента с точками
  const carousel = $('.js-carousel')
  const dots = $('.js-carousel-dots')
  if (carousel && dots) {
    // Фото внутри карточки: ленту и точки строим до клонов карусели, чтобы клоны вышли с готовой разметкой
    $$('.card__img', carousel).forEach((view) => {
      const cardDots = $('.js-card-dots', view)
      const count = $$('.js-slides > *', view).length
      cardDots.innerHTML = count > 1 ? '<span></span>'.repeat(count) : ''
      $$('.js-prev, .js-next', view).forEach((b) => (b.hidden = count < 2))
      let s
      s = slider(view, { onChange: (k) => $$('span', cardDots).forEach((d, j) => d.classList.toggle('is-active', j === k)) })
      $('.js-prev', view).addEventListener('click', (e) => { e.preventDefault(); s.go(s.index - 1) })
      $('.js-next', view).addEventListener('click', (e) => { e.preventDefault(); s.go(s.index + 1) })
    })
    const per = () => (innerWidth >= 1280 ? 4 : innerWidth >= 992 ? 3 : innerWidth >= 768 ? 2 : 1)
    const mark = (k) => $$('button', dots).forEach((b, p) => b.setAttribute('aria-current', String(p === Math.floor(k / per()))))
    const s = slider(carousel, { loop: true, gap: 12, per, onChange: mark })
    const build = () => {
      dots.innerHTML = ''
      for (let p = 0; p < Math.ceil(s.count / per()); p++) {
        const b = document.createElement('button')
        b.type = 'button'
        b.setAttribute('aria-label', `Страница ${p + 1}`)
        b.addEventListener('click', () => s.go(p * per()))
        dots.append(b)
      }
      mark(s.index)
    }
    let w = innerWidth
    addEventListener('resize', () => w !== innerWidth && ((w = innerWidth), build()))
    build()

    // Вкладки «По цене / По метражу» — порядок карточек
    $$('#similar [data-sort]').forEach((tab, _, all) =>
      tab.addEventListener('click', () => {
        all.forEach((t) => t.setAttribute('aria-selected', String(t === tab)))
        const key = tab.dataset.sort
        const slides = $('.js-slides', carousel)
        $$(':scope > .card:not([data-clone])', slides)
          .sort((a, b) => Number(a.dataset[key]) - Number(b.dataset[key]))
          .forEach((c) => slides.append(c))
        s.rebuild()
        s.go(0, false)
      }),
    )
  }

  // [Формы] Маска телефона +7-999-999-99-99, как на сайте (jquery.mask): ведущие 7/8 считаем кодом страны
  $$('.js-phone').forEach((input) =>
    input.addEventListener('input', () => {
      let d = input.value.replace(/\D/g, '')
      if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1)
      d = d.slice(0, 10)
      const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)]
      input.value = d ? '+7-' + p.filter(Boolean).join('-') : ''
    }),
  )

  // Карточка объекта в окнах «Посмотреть объект» / «Какую цену…»: фото, тег, заголовок, цены, адрес, метро, площадь — со страницы (или окна подборки)
  const fillObjCard = (card, root) => {
    const t = (sel) => $(sel, root)?.textContent.trim() || ''
    const esc = (x) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    const prices = $$('#price .p-value', root).map((p) => p.textContent.trim())
    const metro = t('#object-title .metro')
    // Плашки как на сайте: «Окупаемость: 12 лет», «Доход: 250 000 р/мес» — из таблицы арендатора
    const row = (key) => $$('#tenant .kv__row', root).find((r) => $('.kv__key', r).textContent.startsWith(key))?.querySelector('.kv__val').textContent || ''
    const payback = row('Окупаемость').replace(/\s*\(.*\)/, '')
    const income = row('Месячная арендная плата').replace(/\s*руб\.?/, '')
    const tags = [payback && `Окупаемость: ${payback}`, income && `Доход: ${income} р/мес`].filter(Boolean)
    card.innerHTML = `<img class="obj-card__photo" src="${$('#gallery .js-slides img', root)?.getAttribute('src') || ''}" alt="" />
      <div class="obj-card__body">
        <div class="obj-card__tags">${tags.map((x) => `<span class="tag"><span class="tag__body">${esc(x)}</span><img class="tag__tail" src="../img/icons/tag-tail.svg" alt="" /></span>`).join('')}</div>
        <p class="obj-card__title">${esc(t('#object-title h1'))}</p>
        <div class="obj-card__price"><span>Цена: <b>${esc(prices[0] || '')}</b></span><span>за м2: <b>${esc(prices[1] || '')}</b></span></div>
        <p class="obj-card__row"><img src="../img/icons/pin.svg" alt="" />${esc(t('#object-title .address'))}</p>
        ${metro ? `<p class="obj-card__row"><img src="../img/icons/metro.svg" alt="" />${esc(metro)}</p>` : ''}
        <p class="obj-card__row"><img src="../img/icons/area.svg" alt="" />Площадь - ${esc(t('#params .kv__val'))}</p>
      </div>`
  }

  // [Окна] data-modal="<id>" открывает окно; закрыть — крестик, подложка, Esc (Esc — наше удобство)
  const modalOpen = (id, from) => {
    const m = document.getElementById(id)
    if (!m) return
    const card = $('.js-obj-card', m)
    if (card) fillObjCard(card, from?.closest('.sheet') || document)
    layerToggle(m, true)
    setTimeout(() => $('input', m)?.focus({ preventScroll: true }), 50)
  }
  const modalClose = (m) => layerToggle(m, false)
  $$('[data-modal]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); modalOpen(b.dataset.modal, b) }))
  $$('.modal').forEach((m) => {
    $('.js-modal-close', m).addEventListener('click', () => modalClose(m))
    m.addEventListener('click', (e) => e.target === m && modalClose(m))
  })
  addEventListener('keydown', (e) => {
    const m = $$('.modal.is-in').pop()
    if (e.key === 'Escape' && m) { e.stopImmediatePropagation(); modalClose(m) }
  }, true)
  $$('.js-today').forEach((el) => (el.textContent = new Date().toLocaleDateString('ru-RU')))

  // «Ваша заявка принята!»: как openOkPopup() на сайте — день недели по часам браузера, час — по Москве (UTC+3)
  const successText = () => {
    const now = new Date()
    const h = (now.getUTCHours() + 3) % 24
    const day = now.getDay()
    if (day === 6 || day === 0) return 'свяжемся с вами в понедельник в 10:00, если у вас срочный вопрос, вы можете связаться с нами по рабочему телефону.'
    if (h > 20 || h < 8) return 'свяжемся с вами завтра в 10:00 по Московскому времени'
    return 'свяжемся с вами в ближайшее время'
  }
  const success = (form) => {
    form.reset()
    form.dispatchEvent(new Event('sent'))
    $$('.is-error', form).forEach((i) => i.classList.remove('is-error'))
    const own = form.closest('.modal')
    if (own) modalClose(own)
    const m = $('#m-success')
    if (m) { $('.js-success-text', m).textContent = successText(); layerToggle(m, true) }
  }

  // Проверка, как на сайте: пустые обязательные поля и неполный телефон — красная рамка и розовый фон; первая цифра после +7 — не 7 и не 8
  const valid = (form) => {
    let ok = true
    $$('.js-req, .js-phone', form).forEach((i) => {
      if (!i.offsetParent) return
      const d = i.value.replace(/\D/g, '')
      const bad = i.classList.contains('js-phone') ? d.length < 11 || /^7[78]/.test(d) : !i.value.trim()
      i.classList.toggle('is-error', bad)
      if (bad) ok = false
    })
    return ok
  }
  $$('.js-req, .js-phone').forEach((i) => i.addEventListener('input', () => i.classList.remove('is-error')))
  $$('.js-phone-form, .js-lead-form').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault()
      if (valid(f)) success(f)
    }),
  )

  // [Цена] «Уведомить о снижении цены» — без окна: первое нажатие раскрывает поле, кнопка становится «Уведомить меня»
  $$('.js-notify').forEach((f) => {
    const btn = $('.btn', f)
    const label = $('span', btn)
    const text = label.textContent
    btn.addEventListener('click', () => {
      if (!f.classList.contains('is-open')) {
        f.classList.add('is-open')
        label.textContent = btn.dataset.open
        $('.js-phone', f).focus()
      } else if (valid(f)) success(f)
    })
    f.addEventListener('sent', () => {
      f.classList.remove('is-open')
      label.textContent = text
    })
  })

  // [Плашка] «Объявление смотрят» — закрыть
  const toast = $('#viewers-toast')
  if (toast) $('.js-toast-close', toast).addEventListener('click', () => (toast.hidden = true))

  // [Футер] Текст «Компания Malina Property…» — клик раскрывает (как на сайте)
  $$('#footer .footer-about').forEach((t) => t.addEventListener('click', () => t.classList.add('is-open')))

  // [Виджет брокера] Круг → панель «Задайте вопрос»; крестик закрывает
  $$('.js-broker-widget').forEach((w) => {
    $('.js-bw-open', w).addEventListener('click', () => w.classList.add('is-open'))
    $('.js-bw-close', w).addEventListener('click', () => w.classList.remove('is-open'))
  })

  // [Плашка Telegram] × прячет до перезагрузки страницы (дирижёр: «после обновления опять появляется»)
  const tg = $('.js-tg')
  if (tg) {
    tg.hidden = false
    $('.js-tg-close', tg).addEventListener('click', () => (tg.hidden = true))
  }

  // [Квиз] «Ищете помещение на покупку?» — через 70 с при каждой загрузке, как на сайте; клик по варианту — сразу следующий шаг
  const quiz = $('.js-quiz')
  if (quiz) {
    const data = JSON.parse($('.js-quiz-data', quiz).textContent)
    const steps = $$('[data-step]', quiz)
    const show = (name) => steps.forEach((st) => (st.hidden = st.dataset.step !== name))
    let branch = [], at = 0
    const ask = () => {
      if (at >= branch.length) return show('phone')
      const [q, opts] = branch[at]
      $('.js-quiz-q', quiz).textContent = q
      $('.js-quiz-options', quiz).innerHTML = opts.map((o) => `<button type="button">${o}</button>`).join('')
      show('question')
    }
    $$('[data-branch]', quiz).forEach((b) => b.addEventListener('click', () => { branch = data[b.dataset.branch]; at = 0; ask() }))
    $('.js-quiz-options', quiz).addEventListener('click', (e) => { if (e.target.closest('button')) { at++; ask() } })
    $('.js-quiz-form', quiz).addEventListener('submit', (e) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      const phone = $('.js-phone', quiz)
      const d = phone.value.replace(/\D/g, '')
      if (d.length < 11 || /^7[78]/.test(d)) return phone.classList.add('is-error')
      show('done')
    })
    $('.js-quiz-close', quiz).addEventListener('click', () => quiz.remove())
    setTimeout(() => quiz.isConnected && (quiz.hidden = false), 70000)
  }

  // [Кнопки] Наверх — видна всегда, как на сайте; плавно
  const up = $('.js-up')
  if (up) up.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }))

  // [Подборка] «Интересно» — отметка объекта, без перехода
  $$('.js-interest').forEach((b) =>
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))),
  )

  // [Подборка] Окно «Открытый объект»: клик по карточке (не по кнопке) — окно с её объектом (данные — blocks/selection/objects.html),
  // закрыть — крестик, затемнение, Esc
  const selModal = $('.js-sel-modal')
  const selData = $('#sel-objects')
  if (selModal && selData) {
    const objects = JSON.parse(selData.textContent)
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    const ICONS = { Площадь: 'area', Этаж: 'floor', Планировка: 'layout', Отделка: 'finish', 'Высота потолков': 'ceiling', 'Мощность электроэнергии': 'power', Парковка: 'parking' }
    const rows = (list, icons) =>
      list.map(([k, v]) => {
        const icon = icons && ICONS[k] ? `<img src="../img/icons/${ICONS[k]}.svg" alt="" />` : ''
        return `<div class="kv__row">${icon}<span class="kv__key">${esc(k)}</span><span class="kv__val">${esc(v)}</span></div>`
      }).join('')
    const fill = (o) => {
      const m = selModal
      $('#object-title h1', m).textContent = o.title
      $('#object-title .views', m).textContent = o.views ? `Просмотров: ${o.views}` : ''
      $('#object-title .tag__body', m).textContent = o.type
      $('#object-title .address', m).textContent = o.address
      const metro = $('#object-title .metro', m)
      metro.hidden = !o.metro
      metro.lastChild.textContent = o.metro || ''
      const dir = `../img/selection/obj-${o.n}/`
      $('#gallery .js-slides img', m).alt = o.title
      $('#gallery .js-thumbs', m).innerHTML = Array.from({ length: o.photos }, (_, i) =>
        `<button class="thumb" type="button" data-src="${dir}${i + 1}.jpg" aria-label="Фото ${i + 1}"><img src="${dir}t${i + 1}.jpg" alt="" /></button>`).join('')
      $('#gallery', m).dispatchEvent(new Event('gallery:reset'))
      const pv = $$('#price .p-value', m)
      pv[0].firstChild.textContent = o.price + ' '
      pv[1].firstChild.textContent = o.price_m2 + ' '
      $('#params', m).innerHTML = rows(o.params, true)
      $('#tenant .kv', m).innerHTML = rows(o.tenant)
      $('#tenant', m).hidden = !o.tenant.length
      $('#terms .kv', m).innerHTML = rows(o.terms)
      $('#terms', m).hidden = !o.terms.length
      $('#description', m).innerHTML = o.description.map((p) => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`).join('')
      $('#contact .if-manager .agent-name', m).textContent = o.broker || 'Андрей'
    }
    const open = (on) => {
      layerToggle(selModal, on)
      if (on) selModal.scrollTop = 0
    }
    const show = (card) => {
      const o = objects.find((x) => String(x.n) === card.dataset.obj)
      if (o) fill(o)
      open(true)
    }
    $$('.js-sel-open').forEach((card) => {
      card.addEventListener('click', (e) => !e.target.closest('button, a') && show(card))
      card.addEventListener('keydown', (e) => e.key === 'Enter' && e.target === card && show(card))
    })
    $('.js-sel-close', selModal).addEventListener('click', () => open(false))
    selModal.addEventListener('click', (e) => (e.target === selModal || e.target === selModal.firstElementChild) && open(false))
    // capture — раньше галереи: Esc сначала закрывает полноэкранную галерею, потом окно
    addEventListener('keydown', (e) => e.key === 'Escape' && !selModal.hidden && open(false), true)
  }

  // [Телефон] Закреплённые кнопки: появляются, когда прокрутили цену, и прячутся, пока видны такие же кнопки в контактах
  const sticky = $('.js-sticky-actions')
  const price = $('#price')
  const contact = $('.js-contact-actions')
  if (sticky && price && contact) {
    let passedPrice = false
    let contactVisible = false
    const update = () => sticky.classList.toggle('is-shown', mobile.matches && passedPrice && !contactVisible)
    new IntersectionObserver(([e]) => {
      passedPrice = !e.isIntersecting && e.boundingClientRect.top < 0
      update()
    }).observe(price)
    new IntersectionObserver(([e]) => {
      contactVisible = e.isIntersecting
      update()
    }).observe(contact)
    mobile.addEventListener('change', update)
  }
})()
