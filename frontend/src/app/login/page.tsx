'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetParam = urlParams.get('reset');
    const approveParam = urlParams.get('approve');
    if (resetParam) {
      setResetToken(resetParam);
      setMode('reset');
    }
    if (approveParam) {
      authAPI.approveByToken(approveParam)
        .then(() => {
          setSuccess('Utilizador aprovado. Já pode entrar.');
          setMode('login');
        })
        .catch((err: any) => {
          setError(err.response?.data?.error || 'Não foi possível aprovar o utilizador');
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        router.push('/');
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('As passwords não coincidem');
          setLoading(false);
          return;
        }
        const result = await register(email, password);
        if (result.requiresApproval) {
          setSuccess('Conta criada. Fica pendente de aprovação. Depois disso pode entrar.');
        } else {
          setSuccess('Conta criada. Pode agora entrar.');
        }
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } else if (mode === 'forgot') {
        const response = await authAPI.forgotPassword(email);
        setSuccess(response.data.message || 'Se existir uma conta com este email, enviámos um link de recuperação.');
      } else if (mode === 'reset') {
        await authAPI.resetPassword(resetToken, newPassword);
        setSuccess('Password redefinida com sucesso!');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operação falhou');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl text-center text-primary-600">
            {mode === 'login' ? 'Entrar' :
             mode === 'register' ? 'Registar' :
             mode === 'forgot' ? 'Recuperar Password' :
             'Nova Password'}
          </CardTitle>
          <p className="text-center text-gray-600 mt-2">
            {mode === 'login' ? 'Bem-vindo de volta!' :
             mode === 'register' ? 'Crie a sua conta' :
             mode === 'forgot' ? 'Introduza o seu email' :
             'Defina a sua nova password'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={mode === 'reset'}
              />
            </div>
            {mode !== 'forgot' && mode !== 'reset' && (
              <>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {mode === 'register' && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar Password
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                )}
              </>
            )}
            {mode === 'reset' && (
              <>
                <div>
                  <label htmlFor="resetToken" className="block text-sm font-medium text-gray-700 mb-1">
                    Token de Recuperação
                  </label>
                  <Input
                    id="resetToken"
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Cole o token aqui"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'A processar...' :
               mode === 'login' ? 'Entrar' :
               mode === 'register' ? 'Registar' :
               mode === 'forgot' ? 'Enviar Link' :
               'Redefinir Password'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccess('');
                  }}
                  className="block text-primary-600 hover:text-primary-700 text-sm"
                >
                  Não tem conta? Registar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setSuccess('');
                  }}
                  className="block text-primary-600 hover:text-primary-700 text-sm"
                >
                  Esqueceu a password?
                </button>
              </>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-primary-600 hover:text-primary-700 text-sm"
              >
                Já tem conta? Entrar
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className="text-primary-600 hover:text-primary-700 text-sm"
              >
                Voltar ao login
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className="text-primary-600 hover:text-primary-700 text-sm"
              >
                Voltar ao login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
