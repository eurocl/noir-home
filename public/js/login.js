document.addEventListener(
  "DOMContentLoaded",
  () => {

    const form =
      document.querySelector(
        ".luxury-login"
      );

    form.addEventListener(
      "submit",
      async (e) => {

        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (button.disabled) return;
        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = "Iniciando sesión…";
        const waiting = setTimeout(() => {
          button.textContent = "Conectando, esperá un momento…";
        }, 5000);

        const email =
          document.querySelector(
            'input[name="email"]'
          ).value;

        const password =
          document.querySelector(
            'input[name="password"]'
          ).value;

        try {

          const response =
            await fetch(
              "/login",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  email,
                  password
                })

              }
            );

          const data =
            await response.json();

          if (response.ok) {

            localStorage.setItem(
              "token",
              data.token
            );

            alert(
              "Iniciaste sesión correctamente"
            );

            window.location.href =
              "/";

          } else {

            alert(
              data.message
            );

          }

        } catch (err) {

          console.log(err);

          alert(
            "No se pudo iniciar sesión. Intentá nuevamente."
          );

        } finally {
          clearTimeout(waiting);
          button.disabled = false;
          button.textContent = originalLabel;
        }

      }
    );

  }
);
