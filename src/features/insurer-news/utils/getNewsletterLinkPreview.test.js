import assert from 'node:assert/strict'
import test from 'node:test'
import { getNewsletterLinkPreview } from './getNewsletterLinkPreview.js'

const samplePreview = {
  url: 'https://thedoum-counseling.co.kr/',
  title: '내 보험금 조금 더 받기 프로젝트',
  description: '설명',
  imageUrl: 'https://example.com/og.jpg',
}

test('getNewsletterLinkPreview reads payload.linkPreview', () => {
  const preview = getNewsletterLinkPreview({
    bodyText: 'https://thedoum-counseling.co.kr/',
    payload: { linkPreview: samplePreview },
  })
  assert.equal(preview?.url, samplePreview.url)
  assert.equal(preview?.title, samplePreview.title)
})

test('getNewsletterLinkPreview reads top-level linkPreview', () => {
  const preview = getNewsletterLinkPreview({
    bodyText: 'https://example.com/',
    linkPreview: samplePreview,
  })
  assert.equal(preview?.url, samplePreview.url)
})

test('getNewsletterLinkPreview returns null when preview missing', () => {
  const preview = getNewsletterLinkPreview({
    bodyText: 'https://example.com/',
    payload: {},
  })
  assert.equal(preview, null)
})

test('getNewsletterLinkPreview parses string payload JSON', () => {
  const preview = getNewsletterLinkPreview({
    bodyText: 'https://example.com/',
    payload: JSON.stringify({ linkPreview: samplePreview }),
  })
  assert.equal(preview?.url, samplePreview.url)
})
