import React from 'react'

const STATUS_STYLES = {
  '商談中': 'bg-blue-100 text-blue-700',
  '提案済': 'bg-purple-100 text-purple-700',
  '成約': 'bg-green-100 text-green-700',
  '失注': 'bg-red-100 text-red-700',
  'リード': 'bg-yellow-100 text-yellow-700',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`status-badge ${style}`}>
      {status}
    </span>
  )
}
