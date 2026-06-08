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
              "Login successful"
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
            "Login error"
          );

        }

      }
    );

  }
);