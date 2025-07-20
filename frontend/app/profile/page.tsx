"use client"

import { useState, useEffect } from "react"
import { UserProfile } from "@/components/user-profile"
import { authService } from "@/lib/auth"
import type { Staff } from "@/lib/config"

export default function ProfilePage() {
  const [user, setUser] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      const userInfo = await authService.getCurrentUser()
      if (userInfo.success && userInfo.user) {
        setUser(userInfo.user)
      }
      setLoading(false)
    }
    fetchUser()
  }, [])

  const handleUserUpdate = (updatedUser: Staff) => {
    setUser(updatedUser)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p>加载中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <p>无法加载用户信息。</p>
      </div>
    )
  }

  return <UserProfile user={user} onUserUpdate={handleUserUpdate} />
}
