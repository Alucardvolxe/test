# Scaling matrix (2x zoom)
import numpy as np
import matplotlib.pyplot as plt




scale_matrix = np.array([
    [2, 0],
    [0, 2]
])

# Original coordinates
points = np.array([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
])

scaled_points = points @ scale_matrix

plt.plot(points[:,0], points[:,1], 'o-', label='Original')
plt.plot(scaled_points[:,0], scaled_points[:,1], 'o-', label='Scaled')
plt.legend()
plt.title("Scaling using Matrix Multiplication")
plt.axis('equal')
plt.show()
