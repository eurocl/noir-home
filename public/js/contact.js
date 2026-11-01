const form = document.querySelector('#contact-form')
const status = document.querySelector('#contact-status')

form.addEventListener('submit', event => {
  event.preventDefault()
  const name = document.querySelector('#contact-name')
  const email = document.querySelector('#contact-email')
  const message = document.querySelector('#contact-message')
  name.setCustomValidity(name.value.trim() ? '' : 'Escribí tu nombre.')
  message.setCustomValidity(message.value.trim().length >= 10 ? '' : 'Escribí un mensaje de al menos 10 caracteres.')
  if (!form.reportValidity()) return
  const subject = 'Consulta sobre Proyecto Noir'
  const body = `Nombre: ${name.value.trim()}\nCorreo: ${email.value.trim()}\n\n${message.value.trim()}`
  status.textContent = 'Se solicitó abrir tu aplicación de correo. El mensaje todavía no fue enviado. Si no se abre, escribinos a home.designe.info@gmail.com.'
  window.location.href = `mailto:home.designe.info@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

form.addEventListener('input', event => {
  event.target.setCustomValidity?.('')
  status.textContent = ''
})
