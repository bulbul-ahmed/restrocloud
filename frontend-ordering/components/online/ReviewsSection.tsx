'use client'
import { useState, useEffect } from 'react'
import { Star, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import * as onlineApi from '../../lib/online.api'
import type { Review } from '../../types/online.types'

function StarRow({ rating, onChange, size = 20 }: { rating: number; onChange?: (r: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star
            size={size}
            className={n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
          />
        </button>
      ))}
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  slug: string
  token: string | null
  isLoggedIn: boolean
  onLoginRequired: () => void
}

export default function ReviewsSection({ slug, token, isLoggedIn, onLoginRequired }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    onlineApi.getReviews(slug)
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  const displayed = showAll ? reviews : reviews.slice(0, 3)

  const handleSubmit = async () => {
    if (!isLoggedIn) { onLoginRequired(); return }
    if (!token) return
    setSubmitting(true)
    try {
      await onlineApi.submitReview(slug, token, { rating, comment: comment.trim() || undefined })
      setSubmitted(true)
      setShowForm(false)
      toast.success('Review submitted — it will appear after moderation')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="px-4 pb-8 max-w-lg mx-auto">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mt-0.5">
              <StarRow rating={Math.round(avgRating)} size={14} />
              <span className="text-xs text-gray-500">{avgRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        {!submitted && (
          <button
            onClick={() => isLoggedIn ? setShowForm(s => !s) : onLoginRequired()}
            className="text-sm text-brand font-medium"
          >
            {showForm ? 'Cancel' : 'Write a Review'}
          </button>
        )}
      </div>

      {/* Write review form */}
      {showForm && (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <p className="text-sm text-gray-700 mb-2 font-medium">Your rating</p>
            <StarRow rating={rating} onChange={setRating} size={28} />
          </div>
          <textarea
            placeholder="Tell us about your experience (optional)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-brand text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* Review list */}
      {reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No reviews yet — be the first!</p>
      ) : (
        <div className="space-y-3">
          {displayed.map(review => (
            <div key={review.id} className="bg-white rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {review.customer?.firstName?.charAt(0).toUpperCase() ?? 'A'}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{review.customer?.firstName ?? 'Customer'}</span>
                </div>
                <span className="text-xs text-gray-400">{fmtDate(review.createdAt)}</span>
              </div>
              <StarRow rating={review.rating} size={14} />
              {review.comment && <p className="text-sm text-gray-600 mt-2">{review.comment}</p>}
            </div>
          ))}

          {reviews.length > 3 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-2xl hover:bg-gray-50"
            >
              {showAll ? <><ChevronUp size={14} /> Show Less</> : <><ChevronDown size={14} /> Show All {reviews.length} Reviews</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
