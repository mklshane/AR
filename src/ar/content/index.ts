import type { ContentItem } from '../types'
import type { BuildContext, ContentNode } from './ContentNode'
import { buildCutout } from './cutout'
import { buildAudio, buildImage, buildModel, buildText, buildVideo } from './media'
import { buildCloud, buildHeart, buildStar } from './shapes'
import { buildTimeline } from './timeline'
import { buildAlphaVideo } from './alphaVideo'
import { buildFilm } from './film'

/** Content type → builder. Add a new content type by adding a builder here and a type in types.ts. */
export function buildContent(item: ContentItem, ctx: BuildContext): Promise<ContentNode> {
  switch (item.type) {
    case 'cutout':
      return buildCutout(item, ctx)
    case 'star':
      return buildStar(item, ctx)
    case 'heart':
      return buildHeart(item, ctx)
    case 'cloud':
      return buildCloud(item, ctx)
    case 'text':
      return buildText(item, ctx)
    case 'image':
      return buildImage(item, ctx)
    case 'video':
      return buildVideo(item, ctx)
    case 'film':
      return buildFilm(item, ctx)
    case 'model':
      return buildModel(item, ctx)
    case 'timeline':
      return buildTimeline(item, ctx)
    case 'alpha-video':
      return buildAlphaVideo(item, ctx)
    case 'audio':
      return buildAudio(item)
  }
}
