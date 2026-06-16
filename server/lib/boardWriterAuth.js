import jwt from 'jsonwebtoken'
import { BOARD_WRITER_JWT_KIND, PUBLIC_BOARD_WRITER_JWT_KIND } from './lib/boardWriterService.js'

/**
 * @param {string} jwtSecret
 */
export function createRequireBoardWriterAuth(jwtSecret) {
  return function requireBoardWriterAuth(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      res.status(401).json({ message: '로그인이 필요합니다.' })
      return
    }
    try {
      const decoded = jwt.verify(token, jwtSecret)
      const kind = String(decoded.kind ?? '')
      if (kind !== BOARD_WRITER_JWT_KIND && kind !== PUBLIC_BOARD_WRITER_JWT_KIND) {
        res.status(401).json({ message: '게시판 작성자 세션이 아닙니다.' })
        return
      }
      const writerId = String(decoded.writerAccountId ?? decoded.writerId ?? decoded.sub ?? '').trim()
      if (!writerId) {
        res.status(401).json({ message: '유효하지 않은 작성자 세션입니다.' })
        return
      }
      req.boardWriter = {
        id: writerId,
        loginId: typeof decoded.loginId === 'string' ? decoded.loginId : '',
        writerScope: typeof decoded.writerScope === 'string' ? decoded.writerScope : 'global',
        ownerGaId: decoded.ownerGaId == null ? null : Number(decoded.ownerGaId),
        allowedBoardIds: Array.isArray(decoded.allowedBoardIds)
          ? decoded.allowedBoardIds.map((v) => String(v))
          : [],
      }
      req.publicBoardWriter = req.boardWriter
      next()
    } catch {
      res.status(401).json({ message: '로그인이 필요합니다.' })
    }
  }
}

/** @deprecated createRequireBoardWriterAuth 사용 */
export function createRequirePublicBoardWriterAuth(jwtSecret) {
  return createRequireBoardWriterAuth(jwtSecret)
}
