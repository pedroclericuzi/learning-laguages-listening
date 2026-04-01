import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__icon">💥</div>
          <h1 className="error-boundary__title">Algo deu errado</h1>
          <p className="error-boundary__message">
            Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao início.
          </p>
          <div className="error-boundary__actions">
            <button
              className="error-boundary__btn error-boundary__btn--primary"
              onClick={this.handleReload}
            >
              Recarregar
            </button>
            <button
              className="error-boundary__btn error-boundary__btn--secondary"
              onClick={this.handleGoHome}
            >
              Ir ao início
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
