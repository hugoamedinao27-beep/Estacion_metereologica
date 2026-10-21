using EstacionMeteorologica.Models;
using EstacionMeteorologica.Services;
using Microsoft.AspNetCore.Mvc;

namespace EstacionMeteorologica.Controllers;

/// <summary>
/// Configuración de umbrales de alerta.
/// El POST valida con DataAnnotations + reglas cruzadas (IValidatableObject),
/// persiste en Firebase y confirma con TempData.
/// </summary>
public class SettingsController : Controller
{
    private readonly IFirebaseService _firebase;

    public SettingsController(IFirebaseService firebase)
    {
        _firebase = firebase;
    }

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        ViewBag.FirebaseConfigured = _firebase.IsConfigured;
        var model = await _firebase.GetConfigAsync();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Index(ThresholdConfig model)
    {
        ViewBag.FirebaseConfigured = _firebase.IsConfigured;

        if (!ModelState.IsValid)
        {
            TempData["Status"] = "error";
            TempData["Message"] = "Revisar los errores indicados: los umbrales no son válidos.";
            return View(model);
        }

        if (!_firebase.IsConfigured)
        {
            TempData["Status"] = "warning";
            TempData["Message"] = "Firebase no está configurado: los umbrales no se pudieron guardar.";
            return View(model);
        }

        try
        {
            await _firebase.SaveConfigAsync(model);
            TempData["Status"] = "success";
            TempData["Message"] = "Umbrales guardados correctamente. Las próximas lecturas usarán esta configuración.";
        }
        catch (Exception)
        {
            TempData["Status"] = "error";
            TempData["Message"] = "No fue posible guardar en Firebase. Intente nuevamente.";
        }

        return RedirectToAction(nameof(Index));
    }
}
