using System.Text.Json;
using System.Text.Json.Serialization;
using EstacionMeteorologica.Models;
using EstacionMeteorologica.Models.ViewModels;
using EstacionMeteorologica.Services;
using Microsoft.AspNetCore.Mvc;

namespace EstacionMeteorologica.Controllers;

/// <summary>
/// Dashboard en vivo: muestra la última lectura del sensor y expone
/// /Dashboard/Latest como API JSON que el navegador consulta periódicamente.
/// </summary>
public class DashboardController : Controller
{
    private readonly IFirebaseService _firebase;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    public DashboardController(IFirebaseService firebase)
    {
        _firebase = firebase;
    }

    public async Task<IActionResult> Index()
    {
        var model = new DashboardViewModel
        {
            Latest = await _firebase.GetLatestReadingAsync(),
            Config = await _firebase.GetConfigAsync(),
            FirebaseConfigured = _firebase.IsConfigured
        };
        return View(model);
    }

    /// <summary>
    /// Endpoint consumido por el JavaScript del dashboard cada pocos segundos.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Latest()
    {
        try
        {
            var reading = await _firebase.GetLatestReadingAsync();
            var config = await _firebase.GetConfigAsync();

            return Json(new
            {
                ok = true,
                configured = _firebase.IsConfigured,
                reading,
                config
            }, JsonOptions);
        }
        catch (Exception)
        {
            return Json(new { ok = false, error = "No se pudieron obtener los datos del sensor." });
        }
    }
}
