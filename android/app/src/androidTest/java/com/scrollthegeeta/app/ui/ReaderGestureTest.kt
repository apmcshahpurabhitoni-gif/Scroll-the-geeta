package com.scrollthegeeta.app.ui

import androidx.compose.ui.test.assertExists
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import com.scrollthegeeta.app.data.VersePage
import org.junit.Rule
import org.junit.Test

class ReaderGestureTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val verses = listOf(
        VersePage(1, 1, "अर्जुनविषादयोग", "Arjuna's Despair", "धर्मक्षेत्रे कुरुक्षेत्रे", "dharmakṣetre kurukṣetre", "On the field of dharma, at Kurukshetra.", "Swami Sivananda"),
        VersePage(1, 2, "अर्जुनविषादयोग", "Arjuna's Despair", "सञ्जय उवाच", "sañjaya uvāca", "Sanjaya said.", "Swami Sivananda")
    )

    @Test
    fun swipeUpMovesToNextVerseAndSwipeDownReturns() {
        composeRule.setContent { ReaderScreen(verses) }

        composeRule.onNodeWithText("1 / 2", substring = true).assertExists()
        composeRule.onRoot().performTouchInput { swipeUp() }
        composeRule.waitForIdle()
        composeRule.onNodeWithText("2 / 2", substring = true).assertExists()

        composeRule.onRoot().performTouchInput { swipeDown() }
        composeRule.waitForIdle()
        composeRule.onNodeWithText("1 / 2", substring = true).assertExists()
    }
}
