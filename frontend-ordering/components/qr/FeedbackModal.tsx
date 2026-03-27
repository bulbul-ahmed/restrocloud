'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Spinner } from './Spinner'

interface Props {
  restaurantName: string
  onSubmit: (rating: number, comment?: string) => Promise<void>
  onDismiss: () => void
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!']

export function FeedbackModal({ restaurantName, onSubmit, onDismiss }: Props) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const display = hovered || rating

  async function handleSubmit() {
    if (!rating) return
    setLoading(true)
    try {
      await onSubmit(rating, comment.trim() || undefined)
      setDone(true)
      setTimeout(onDismiss, 1800)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onDismiss} />
      <div className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🙏</div>
            <p className="font-bold text-gray-900 text-lg">Thank you!</p>
            <p className="text-gray-500 text-sm mt-1">Your feedback means a lot to us.</p>
          </div>
        ) : (
          <>
            <p className="font-bold text-gray-900 text-lg text-center">How was your experience?</p>
            <p className="text-gray-400 text-sm text-center mt-1 mb-5">at {restaurantName}</p>

            {/* Stars */}
            <div className="flex justify-center gap-3 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(n)}
                >
                  <Star
                    size={36}
                    className={cn(
                      'transition-colors',
                      n <= display ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200',
                    )}
                  />
                </button>
              ))}
            </div>
            {display > 0 && (
              <p className="text-center text-sm font-semibold text-amber-500 mb-4">{LABELS[display]}</p>
            )}

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any comments? (optional)"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand mb-4"
            />

            <button
              onClick={handleSubmit}
              disabled={!rating || loading}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-brand text-white flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
            >
              {loading ? <Spinner className="text-white" /> : 'Submit Feedback'}
            </button>
            <button onClick={onDismiss} className="w-full text-sm text-gray-400 py-2">
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  )
}
