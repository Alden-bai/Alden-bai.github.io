<script setup>
import { data as notebook } from '../notes.data.mjs'
import SectionCards from './SectionCards.vue'
</script>

<template>
  <main class="nest-home">
    <section class="nest-hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <span class="eyebrow"><span class="little-star" aria-hidden="true">✳</span> 一个慢慢积累的学习角落</span>
        <h1 id="home-title">布吉熊的<span>小窝<span class="title-dot">。</span></span></h1>
        <p class="hero-description">把学过的知识、闪过的想法，<br class="desktop-break">整理成可以随时翻阅的笔记。</p>
        <div class="hero-actions">
          <a class="nest-button primary" href="/notes/">翻开笔记专区 <span aria-hidden="true">↗</span></a>
          <a class="github-link" href="https://github.com/Alden-bai" target="_blank" rel="noopener noreferrer">我的 GitHub <span aria-hidden="true">↗</span></a>
        </div>
        <div class="hero-footnote"><span aria-hidden="true"></span> 保持好奇，慢慢来。</div>
      </div>
      <div class="desk-scene" aria-hidden="true">
        <div class="scene-orbit"></div>
        <span class="scene-spark spark-one">✳</span><span class="scene-spark spark-two">+</span>
        <div class="paper-under"></div>
        <div class="notebook">
          <div class="book-binding"><i v-for="i in 6" :key="i"></i></div>
          <div class="book-content">
            <div class="book-label">MY LEARNING NOTES <span>✦</span></div>
            <div class="bear-drawing">
              <svg viewBox="0 0 220 180" fill="none">
                <path d="M56 56C22 47 29 10 54 12C75 12 83 31 79 43M143 43C136 20 155 7 171 14C195 22 190 52 168 57" fill="var(--bear-fill)" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <path d="M176 83C181 122 159 147 111 147C62 147 40 124 44 85C47 49 70 34 110 34C150 34 173 51 176 83Z" fill="var(--bear-fill)" stroke="currentColor" stroke-width="4"/>
                <ellipse cx="84" cy="84" rx="4" ry="6" fill="currentColor"/><ellipse cx="139" cy="84" rx="4" ry="6" fill="currentColor"/>
                <ellipse cx="111" cy="106" rx="24" ry="18" fill="var(--paper)"/>
                <path d="M104 99Q111 95 118 99Q117 106 111 107Q105 106 104 99Z" fill="currentColor"/>
                <path d="M111 107V112M100 113Q105 121 111 113Q117 121 122 113" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M64 99H76M147 99H159" stroke="#efb6ad" stroke-width="5" stroke-linecap="round"/>
                <path d="M44 139Q78 129 110 146Q144 129 180 139L176 175Q143 164 110 178Q77 164 47 175Z" fill="var(--book-blue)" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
                <path d="M110 147V177M58 147Q80 143 96 152M124 152Q144 143 166 147" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <ellipse cx="46" cy="151" rx="12" ry="9" fill="var(--bear-fill)" stroke="currentColor" stroke-width="3"/>
                <ellipse cx="177" cy="151" rx="12" ry="9" fill="var(--bear-fill)" stroke="currentColor" stroke-width="3"/>
              </svg>
            </div>
            <div class="book-title">今天也有新的收获</div>
            <div class="book-rule"></div><div class="book-rule short"></div>
            <div class="book-bottom"><span>THINK · LEARN · GROW</span><span>♡</span></div>
          </div>
          <span class="book-ribbon"></span>
        </div>
        <div class="tiny-note">留一页，给新的想法。<svg viewBox="0 0 70 24"><path d="M3 4Q28 29 62 8M52 6L64 7L61 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div>
      </div>
    </section>

    <section class="home-notes" aria-labelledby="home-notes-title">
      <div class="section-heading"><div><span class="section-number">01 / NOTEBOOK</span><h2 id="home-notes-title">笔记专区</h2></div><a class="text-link" href="/notes/">全部专区 <span aria-hidden="true">→</span></a></div>
      <div v-if="!notebook.sections.length" class="home-empty">
        <div class="empty-book-icon" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M20 10Q12 5 5 9V30Q12 26 20 31Q28 26 35 30V9Q28 5 20 10ZM20 10V31M10 14L15 15M10 20L15 21M25 15L30 14M25 21L30 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div><h3>还没有发布笔记</h3><p>新的知识与思考，会慢慢写在这里。</p></div>
        <span class="empty-decoration" aria-hidden="true">每一页，都是一个开始。</span>
      </div>
      <SectionCards v-else :sections="notebook.sections" />
    </section>
  </main>
</template>
