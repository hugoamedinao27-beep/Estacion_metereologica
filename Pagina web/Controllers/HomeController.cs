using EstacionMeteorologica.Models.ViewModels;
using EstacionMeteorologica.Services;
using Microsoft.AspNetCore.Mvc;

namespace EstacionMeteorologica.Controllers;

/// <summary>
/// Páginas informativas del sitio (inicio, arquitectura, futuro).
/// No consume datos en vivo; el contenido es estático.
/// </summary>
public class HomeController : Controller
{
    private readonly IFirebaseService _firebase;

    public HomeController(IFirebaseService firebase)
    {
        _firebase = firebase;
    }

    public IActionResult Index()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View();
    }
}
