using System.Text.Json;
using System.Text.Json.Serialization;
using EstacionMeteorologica.Models.ViewModels;
using EstacionMeteorologica.Services;
using Microsoft.AspNetCore.Mvc;

namespace EstacionMeteorologica.Controllers;

/// <summary>
/// Historial: muestra las últimas lecturas registradas en Firebase
/// y las expone como JSON para el gráfico de tendencia.
/// </summary>
public class HistoryController : Controller
{
    private readonly IFirebaseService _firebase;
    private const int MaxReadings = 120;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() }
    };

    public HistoryController(IFirebaseService firebase)
    {
        _firebase = firebase;
    }

    public async Task<IActionResult> Index()
    {
        var model = new HistoryViewModel
        {
            Readings = await _firebase.GetRecentReadingsAsync(MaxReadings),
            Config = await _firebase.GetConfigAsync(),
            FirebaseConfigured = _firebase.IsConfigured
        };
        return View(model);
    }

    [HttpGet]
    public async Task<IActionResult> Data(int limit = 60)
    {
        try
        {
            limit = Math.Clamp(limit, 1, MaxReadings);
            var readings = await _firebase.GetRecentReadingsAsync(limit);

            return Json(new { ok = true, readings }, JsonOptions);
        }
        catch
        {
            return Json(new { ok = false, error = "No se pudo recuperar el historial." });
        }
    }
}
