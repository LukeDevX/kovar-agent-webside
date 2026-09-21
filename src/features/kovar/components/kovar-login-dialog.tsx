'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { LoaderCircle, LockKeyhole, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

type LoginDialogProps = {
  open: boolean
  isPending: boolean
  needsTwoFactor: boolean
  error?: string
  onOpenChange: (open: boolean) => void
  onLogin: (username: string, password: string) => Promise<void>
  onTwoFactor: (code: string) => Promise<void>
}

export function KovarLoginDialog(props: LoginDialogProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (props.needsTwoFactor) {
      await props.onTwoFactor(code)
      setCode('')
      return
    }
    await props.onLogin(username, password)
    setPassword('')
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby="kovar-login-description">
          <div className="dialog-icon"><LockKeyhole size={20} /></div>
          <Dialog.Title>Connect your Kovar account</Dialog.Title>
          <Dialog.Description id="kovar-login-description">
            Credentials go directly to Kovar Gateway. They are never sent to DeepSeek or saved in chat history.
          </Dialog.Description>
          <Dialog.Close className="dialog-close" aria-label="Close Kovar login">
            <X size={18} />
          </Dialog.Close>
          <form onSubmit={submit}>
            {props.needsTwoFactor ? (
              <label>
                Two-factor code
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={128}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  value={code}
                />
              </label>
            ) : (
              <>
                <label>
                  Username
                  <input
                    autoComplete="username"
                    autoFocus
                    maxLength={128}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    value={username}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    maxLength={256}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
              </>
            )}
            {props.error ? <p className="form-error" role="alert">{props.error}</p> : null}
            <button className="primary-button full-width" disabled={props.isPending} type="submit">
              {props.isPending ? <LoaderCircle className="spin" size={16} /> : null}
              {props.needsTwoFactor ? 'Verify and continue' : 'Sign in securely'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
