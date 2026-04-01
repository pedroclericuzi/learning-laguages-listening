export default function ErrorState({ message, onRetry, icon = '😕' }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">{icon}</div>
      <h2 className="error-state__title">Ops! Algo deu errado</h2>
      <p className="error-state__message">
        {message || 'Não foi possível carregar o conteúdo. Verifique sua conexão e tente novamente.'}
      </p>
      {onRetry && (
        <button className="error-state__retry" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}
