'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { ClientsTable } from '@/components/clients/clients-table'
import { ClientForm, type ClientFormData } from '@/components/clients/client-form'
import type { Client } from '@prisma/client'

export default function ClientsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  
  const utils = api.useUtils()
  const { data: clients, isLoading } = api.clients.list.useQuery()
  
  const createMutation = api.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
      setShowForm(false)
    },
  })
  
  const updateMutation = api.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
      setShowForm(false)
      setEditingClient(null)
    },
  })
  
  const deleteMutation = api.clients.delete.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate()
    },
  })

  const handleSubmit = async (data: ClientFormData) => {
    if (editingClient) {
      await updateMutation.mutateAsync({
        id: editingClient.id,
        ...data,
        isActive: editingClient.isActive,
      })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setShowForm(true)
  }

  const handleDelete = async (client: Client) => {
    if (confirm(`Are you sure you want to delete ${client.name}?`)) {
      await deleteMutation.mutateAsync({ id: client.id })
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingClient(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading clients...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your client information</p>
        </div>

        {showForm ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <ClientForm
              client={editingClient || undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900"
              >
                Add Client
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <ClientsTable
                clients={clients || []}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}