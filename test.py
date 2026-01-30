import numpy as np
import matplotlib.pyplot as plt



image = np.array([
    [50, 80, 120],
    [90, 150, 200],
    [130, 180, 230]
])

plt.imshow(image, cmap='gray')
plt.title("Image as a Matrix")
plt.colorbar()
plt.show()
