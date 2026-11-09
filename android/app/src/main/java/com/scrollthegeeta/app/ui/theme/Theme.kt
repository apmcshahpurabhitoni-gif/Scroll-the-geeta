package com.scrollthegeeta.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Parchment = Color(0xFFFFF6E8)
private val DeepBrown = Color(0xFF4A2412)
private val Saffron = Color(0xFFC87920)
private val AntiqueGold = Color(0xFFE6AD55)
private val MutedBrown = Color(0xFF8B6A50)
private val CardCream = Color(0xFFFFFBF4)

private val ScrollColorScheme = lightColorScheme(
    primary = Saffron,
    onPrimary = Color.White,
    secondary = MutedBrown,
    onSecondary = Color.White,
    tertiary = AntiqueGold,
    background = Parchment,
    onBackground = DeepBrown,
    surface = CardCream,
    onSurface = DeepBrown,
    surfaceVariant = Color(0xFFF5E5CF),
    onSurfaceVariant = MutedBrown,
    outline = Color(0xFFE3BD8B)
)

@Composable
fun ScrollTheGeetaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ScrollColorScheme,
        content = content
    )
}
