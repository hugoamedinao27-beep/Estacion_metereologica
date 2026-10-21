using System.ComponentModel.DataAnnotations;

namespace EstacionMeteorologica.Models;

/// <summary>
/// Umbrales de alerta configurables por el usuario.
/// Reglas de negocio: los umbrales deben ser crecientes (frio &lt; precaucion &lt; calor &lt; critico).
/// </summary>
public class ThresholdConfig : IValidatableObject
{
    [Required(ErrorMessage = "Debe indicar el umbral de frío.")]
    [Range(0, 40, ErrorMessage = "El umbral de frío debe estar entre 0 °C y 40 °C.")]
    [Display(Name = "Alerta por frío (menos de)")]
    public int ColdThreshold { get; set; } = 15;

    [Required(ErrorMessage = "Debe indicar el inicio del estado Precaución.")]
    [Range(1, 50, ErrorMessage = "El umbral de precaución debe estar entre 1 °C y 50 °C.")]
    [Display(Name = "Precaución (desde)")]
    public int CautionThreshold { get; set; } = 25;

    [Required(ErrorMessage = "Debe indicar el inicio del estado Calor.")]
    [Range(2, 60, ErrorMessage = "El umbral de calor debe estar entre 2 °C y 60 °C.")]
    [Display(Name = "Calor (desde)")]
    public int CalorThreshold { get; set; } = 28;

    [Required(ErrorMessage = "Debe indicar el inicio del estado Crítico.")]
    [Range(3, 65, ErrorMessage = "El umbral crítico debe estar entre 3 °C y 65 °C.")]
    [Display(Name = "Crítico (desde)")]
    public int CriticalThreshold { get; set; } = 30;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CautionThreshold <= ColdThreshold)
        {
            yield return new ValidationResult(
                "El umbral de precaución debe ser mayor que el umbral de frío.",
                new[] { nameof(CautionThreshold) });
        }

        if (CalorThreshold <= CautionThreshold)
        {
            yield return new ValidationResult(
                "El umbral de calor debe ser mayor que el umbral de precaución.",
                new[] { nameof(CalorThreshold) });
        }

        if (CriticalThreshold <= CalorThreshold)
        {
            yield return new ValidationResult(
                "El umbral crítico debe ser mayor que el umbral de calor.",
                new[] { nameof(CriticalThreshold) });
        }
    }
}
