import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './icg1-theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

rootElement.classList.add('icg1-theme');

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
