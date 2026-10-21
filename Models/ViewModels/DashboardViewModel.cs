using EstacionMeteorologica.Models;

namespace EstacionMeteorologica.Models.ViewModels;

public class DashboardViewModel
{
    public Reading? Latest { get; set; }
    public ThresholdConfig Config { get; set; } = new();
    public bool FirebaseConfigured { get; set; }
}
